package service

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"
	"time"

	"flec_blog/internal/dto"
	"flec_blog/pkg/logger"
)

const githubRepo = "talen8/FlecBlogTest"

var downloadMirrors = []string{
	"https://ghfast.top/https://github.com",
	"https://ghproxy.net/https://github.com",
	"https://github.com",
}

var (
	upgradeStatus   = dto.UpgradeStatus{Target: "idle", Status: "idle"}
	upgradeMu       sync.Mutex
	upgradeRunning  bool
	upgradeWg       sync.WaitGroup
	upgradeNeedExit bool
)

// InitUpgrade 初始化升级模块（启动时清理旧二进制和残留临时目录）
func InitUpgrade() {
	self, err := os.Executable()
	if err != nil {
		return
	}
	old := self + ".old"
	if _, err := os.Stat(old); err == nil {
		_ = os.Remove(old)
	}

	// 清理上次升级遗留的临时目录（os.Exit 会跳过 defer）
	tmpDir := os.TempDir()
	entries, _ := os.ReadDir(tmpDir)
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), "flec-") && strings.Contains(e.Name(), "-upgrade-") {
			_ = os.RemoveAll(filepath.Join(tmpDir, e.Name()))
		}
	}
}

// GetUpgradeStatus 获取当前升级进度
func GetUpgradeStatus() dto.UpgradeStatus {
	upgradeMu.Lock()
	defer upgradeMu.Unlock()
	return upgradeStatus
}

func setUpgradeStatus(target, status, message string, progress int) {
	upgradeMu.Lock()
	defer upgradeMu.Unlock()
	upgradeStatus = dto.UpgradeStatus{
		Target:   target,
		Status:   status,
		Message:  message,
		Progress: progress,
	}
}

// StartUpgrade 启动异步升级
func StartUpgrade(target, version string) error {
	flecDir := os.Getenv("FLECBLOG_DIR")
	if flecDir == "" {
		return fmt.Errorf("FLECBLOG_DIR 未配置，仅支持原生部署模式升级")
	}

	upgradeMu.Lock()
	if upgradeRunning {
		upgradeMu.Unlock()
		return fmt.Errorf("升级正在进行中")
	}
	upgradeRunning = true
	upgradeNeedExit = false
	upgradeMu.Unlock()

	upgradeWg.Go(func() {
		defer func() {
			upgradeMu.Lock()
			upgradeRunning = false
			upgradeMu.Unlock()
		}()

		switch target {
		case "blog":
			doUpgradeBlog(flecDir, version)
		case "server":
			doUpgradeServer(flecDir, version)
		case "all":
			doUpgradeBlog(flecDir, version)
			s := GetUpgradeStatus()
			if s.Status == "error" {
				return
			}
			doUpgradeServer(flecDir, version)
		}

		if upgradeNeedExit {
			upgradeWg.Wait()
			time.Sleep(1 * time.Second)
			os.Exit(0)
		}
	})

	return nil
}

// ==================== Blog 升级 ====================

func doUpgradeBlog(flecDir, version string) {
	blogDir := filepath.Join(flecDir, "blog")

	setUpgradeStatus("blog", "downloading", fmt.Sprintf("正在下载 Blog %s...", version), 10)

	tarURL := fmt.Sprintf("/%s/releases/download/%s/flec-blog.tar.gz", githubRepo, version)
	tarPath, err := downloadRelease(tarURL)
	if err != nil {
		setUpgradeStatus("blog", "error", "下载失败: "+err.Error(), 0)
		return
	}
	defer func() { _ = os.Remove(tarPath) }()

	setUpgradeStatus("blog", "extracting", "正在备份用户主题...", 30)
	themesSrc := filepath.Join(blogDir, "themes")
	tmpThemes, err := os.MkdirTemp("", "flec-themes-backup-*")
	if err != nil {
		setUpgradeStatus("blog", "error", "创建备份目录失败: "+err.Error(), 0)
		return
	}
	defer func() { _ = os.RemoveAll(tmpThemes) }()

	if err := copyDir(themesSrc, tmpThemes, nil); err != nil {
		setUpgradeStatus("blog", "error", "备份主题失败: "+err.Error(), 0)
		return
	}

	setUpgradeStatus("blog", "extracting", "正在解压更新文件...", 40)
	tmpExtract, err := os.MkdirTemp("", "flec-blog-upgrade-*")
	if err != nil {
		setUpgradeStatus("blog", "error", "创建临时目录失败: "+err.Error(), 0)
		return
	}
	defer func() { _ = os.RemoveAll(tmpExtract) }()

	if err := extractTarGz(tarPath, tmpExtract, ""); err != nil {
		setUpgradeStatus("blog", "error", "解压失败: "+err.Error(), 0)
		return
	}

	srcDir := tmpExtract
	if _, err := os.Stat(filepath.Join(tmpExtract, "package.json")); err != nil {
		entries, _ := os.ReadDir(tmpExtract)
		for _, e := range entries {
			if e.IsDir() {
				if _, err := os.Stat(filepath.Join(tmpExtract, e.Name(), "package.json")); err == nil {
					srcDir = filepath.Join(tmpExtract, e.Name())
					break
				}
			}
		}
	}

	setUpgradeStatus("blog", "extracting", "正在更新系统文件...", 50)
	if err := copyDir(srcDir, blogDir, []string{"themes"}); err != nil {
		setUpgradeStatus("blog", "error", "更新文件失败: "+err.Error(), 0)
		return
	}

	setUpgradeStatus("blog", "extracting", "正在恢复用户主题...", 60)
	if err := copyDir(tmpThemes, themesSrc, nil); err != nil {
		setUpgradeStatus("blog", "error", "恢复主题失败: "+err.Error(), 0)
		return
	}

	setUpgradeStatus("blog", "building", "正在安装依赖 (npm ci)...", 65)
	if err := runInDir(blogDir, "npm", "ci", "--no-audit", "--no-fund"); err != nil {
		restoreErr := copyDir(tmpThemes, themesSrc, nil)
		if restoreErr != nil {
			logger.Error("回滚主题失败: %v", restoreErr)
		}
		setUpgradeStatus("blog", "error", "npm ci 失败: "+err.Error(), 0)
		return
	}

	setUpgradeStatus("blog", "building", "正在构建 (npm run build)...", 80)
	if err := runInDir(blogDir, "npm", "run", "build"); err != nil {
		restoreErr := copyDir(tmpThemes, themesSrc, nil)
		if restoreErr != nil {
			logger.Error("回滚主题失败: %v", restoreErr)
		}
		setUpgradeStatus("blog", "error", "构建失败: "+err.Error(), 0)
		return
	}

	setUpgradeStatus("blog", "restarting", "正在重启 Blog...", 95)
	if err := exec.Command("pm2", "restart", "flec-blog").Run(); err != nil {
		setUpgradeStatus("blog", "error", "重启失败: "+err.Error(), 0)
		return
	}

	setUpgradeStatus("blog", "done", fmt.Sprintf("Blog 已升级至 %s", version), 100)
}

// ==================== Server 升级 ====================

func doUpgradeServer(_, version string) {
	arch := "amd64"
	if runtime.GOARCH == "arm64" {
		arch = "arm64"
	}

	setUpgradeStatus("server", "downloading", fmt.Sprintf("正在下载 Server %s (%s)...", version, arch), 10)
	tarURL := fmt.Sprintf("/%s/releases/download/%s/flec-server_linux_%s.tar.gz", githubRepo, version, arch)
	tarPath, err := downloadRelease(tarURL)
	if err != nil {
		setUpgradeStatus("server", "error", "下载失败: "+err.Error(), 0)
		return
	}
	defer func() { _ = os.Remove(tarPath) }()

	setUpgradeStatus("server", "extracting", "正在解压...", 40)
	tmpDir, err := os.MkdirTemp("", "flec-server-upgrade-*")
	if err != nil {
		setUpgradeStatus("server", "error", "创建临时目录失败: "+err.Error(), 0)
		return
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	if err := extractTarGz(tarPath, tmpDir, ""); err != nil {
		setUpgradeStatus("server", "error", "解压失败: "+err.Error(), 0)
		return
	}

	binaryName := "flec-server"
	if runtime.GOOS == "windows" {
		binaryName += ".exe"
	}

	newBinary := findFile(tmpDir, binaryName)
	if newBinary == "" {
		setUpgradeStatus("server", "error", "二进制文件不存在", 0)
		return
	}

	selfPath, err := os.Executable()
	if err != nil {
		setUpgradeStatus("server", "error", "获取当前进程路径失败: "+err.Error(), 0)
		return
	}
	selfPath, _ = filepath.Abs(selfPath)

	setUpgradeStatus("server", "restarting", "正在替换二进制...", 70)
	if err := os.Rename(selfPath, selfPath+".old"); err != nil {
		setUpgradeStatus("server", "error", "重命名旧二进制失败: "+err.Error(), 0)
		return
	}

	if err := copyFile(newBinary, selfPath); err != nil {
		_ = os.Rename(selfPath+".old", selfPath)
		setUpgradeStatus("server", "error", "替换二进制失败: "+err.Error(), 0)
		return
	}

	if runtime.GOOS != "windows" {
		_ = os.Chmod(selfPath, 0o755) //nolint:gosec // G302 二进制文件需要可执行权限
	}

	setUpgradeStatus("server", "done", fmt.Sprintf("Server 已升级至 %s，正在重启...", version), 100)
	upgradeNeedExit = true
}

// ==================== 工具函数 ====================

func downloadRelease(path string) (string, error) {
	var lastErr error
	for _, mirror := range downloadMirrors {
		url := mirror + path
		tmp, err := downloadToTemp(url)
		if err == nil {
			return tmp, nil
		}
		lastErr = err
	}
	return "", fmt.Errorf("所有镜像下载失败: %w", lastErr)
}

func downloadToTemp(url string) (string, error) {
	resp, err := http.Get(url) //nolint:gosec // G107 从受信任的 GitHub Releases 下载
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	tmp, err := os.CreateTemp("", "flec-upgrade-*.tar.gz")
	if err != nil {
		return "", err
	}
	defer func() { _ = tmp.Close() }()

	if _, err := io.Copy(tmp, resp.Body); err != nil {
		_ = os.Remove(tmp.Name())
		return "", err
	}

	return tmp.Name(), nil
}

func extractTarGz(tarPath, destDir, stripPrefix string) error {
	f, err := os.Open(tarPath) //nolint:gosec // G304 路径由调用方控制
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer func() { _ = gz.Close() }()

	tr := tar.NewReader(gz)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		name := filepath.ToSlash(header.Name)
		name = strings.TrimLeft(name, "/")

		if stripPrefix != "" {
			if !strings.HasPrefix(name, stripPrefix) {
				continue
			}
			name = strings.TrimPrefix(name, stripPrefix)
			name = strings.TrimLeft(name, "/")
		}
		if name == "" {
			continue
		}

		target := filepath.Join(destDir, filepath.FromSlash(name))
		cleanDest := filepath.Clean(destDir)
		cleanTarget := filepath.Clean(target)
		if !strings.HasPrefix(cleanTarget, cleanDest+string(filepath.Separator)) && cleanTarget != cleanDest {
			continue
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o750); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o750); err != nil {
				return err
			}
			outFile, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(header.Mode)) //nolint:gosec // G115 header.Mode 来自 tar 标准格式
			if err != nil {
				return err
			}
			if _, err := io.Copy(outFile, tr); err != nil { //nolint:gosec // G110 已限制 tar 流大小
				_ = outFile.Close()
				return err
			}
			_ = outFile.Close()
		}
	}

	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src) //nolint:gosec // G304 路径由调用方控制
	if err != nil {
		return err
	}
	defer func() { _ = in.Close() }()

	out, err := os.Create(dst) //nolint:gosec // G304 路径由调用方控制
	if err != nil {
		return err
	}
	defer func() { _ = out.Close() }()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func copyDir(src, dst string, skipDirs []string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error { //nolint:gosec // G703 已做路径穿越和符号链接检查
		if err != nil {
			return err
		}

		rel, _ := filepath.Rel(src, path)
		if rel == "." {
			return nil
		}

		parts := strings.SplitN(rel, string(filepath.Separator), 2)
		if len(skipDirs) > 0 && info.IsDir() && slices.Contains(skipDirs, parts[0]) {
			return filepath.SkipDir
		}

		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o750) //nolint:gosec // G703 target 由 rel 计算且 Walk 限定了 src 范围
		}

		if info.Mode()&os.ModeSymlink != 0 {
			link, err := os.Readlink(path)
			if err != nil {
				return err
			}
			absLink := link
			if !filepath.IsAbs(link) {
				absLink = filepath.Join(filepath.Dir(path), link)
			}
			absSrc, _ := filepath.Abs(src)
			if !strings.HasPrefix(absLink, absSrc) {
				return nil
			}
			return os.Symlink(link, target) //nolint:gosec // G122 已验证符号链接目标在源目录内
		}

		return copyFile(path, target)
	})
}

func runInDir(dir, name string, args ...string) error {
	cmd := exec.Command(name, args...) //nolint:gosec // G204 参数由调用方控制
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "NODE_ENV=production")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func findFile(root, name string) string {
	var result string
	_ = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil //nolint:nilerr // 查找文件时跳过错误条目
		}
		if !info.IsDir() && info.Name() == name {
			result = path
			return filepath.SkipDir
		}
		return nil
	})
	return result
}
