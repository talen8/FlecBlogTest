package service

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"flec_blog/internal/dto"
	"flec_blog/internal/model"
	"flec_blog/internal/repository"
	"flec_blog/pkg/logger"
	"flec_blog/pkg/panel"

	"gorm.io/gorm"
)

// getThemesDir 获取主题存储目录（从 FLECBLOG_DIR 推导，与 Nuxt 的 ./themes/ 保持一致）
func getThemesDir() string {
	flecDir := os.Getenv("FLECBLOG_DIR")
	if flecDir == "" {
		return ""
	}
	return filepath.Join(flecDir, "blog", "themes")
}

// ThemeService 主题服务
type ThemeService struct {
	repo           *repository.ThemeRepository
	fileService    *FileService
	premiumService *PremiumService
	panelClient    *panel.Client

	marketMu       sync.Mutex
	marketThemes   []panel.ThemeMeta
	marketSyncTime time.Time

	taskMu      sync.Mutex
	taskTarget  string
	taskStatus  string
	taskMessage string
	taskRunning bool
}

// NewThemeService 创建主题服务实例
func NewThemeService(repo *repository.ThemeRepository, fileService *FileService, premiumService *PremiumService, panelClient *panel.Client) *ThemeService {
	return &ThemeService{repo: repo, fileService: fileService, premiumService: premiumService, panelClient: panelClient}
}

// ============ Blog 重建 ============

const marketSyncInterval = 5 * time.Minute

// fetchMarketThemes 获取市场主题列表（带 5 分钟缓存）
func (s *ThemeService) fetchMarketThemes() []panel.ThemeMeta {
	s.marketMu.Lock()
	defer s.marketMu.Unlock()

	if time.Since(s.marketSyncTime) < marketSyncInterval && s.marketThemes != nil {
		return s.marketThemes
	}

	themes, err := s.panelClient.FetchThemeList(context.Background())
	if err != nil {
		logger.Warn("获取市场主题列表失败: %v", err)
		return s.marketThemes
	}

	s.marketThemes = themes
	s.marketSyncTime = time.Now()
	return themes
}

// ============ 任务状态管理 ============

// TaskStatus 获取当前任务状态
func (s *ThemeService) TaskStatus() dto.TaskStatusResponse {
	s.taskMu.Lock()
	defer s.taskMu.Unlock()
	if s.taskStatus == "" {
		return dto.TaskStatusResponse{Status: "idle"}
	}
	return dto.TaskStatusResponse{
		Target:  s.taskTarget,
		Status:  s.taskStatus,
		Message: s.taskMessage,
	}
}

// taskRunning 检查是否有任务正在执行（调用方需持锁）
func (s *ThemeService) isTaskRunning() bool {
	return s.taskRunning
}

func (s *ThemeService) setTaskStatus(target, status, message string) {
	s.taskMu.Lock()
	defer s.taskMu.Unlock()
	s.taskTarget = target
	s.taskStatus = status
	s.taskMessage = message
}

func (s *ThemeService) acquireTask(target string) bool {
	s.taskMu.Lock()
	defer s.taskMu.Unlock()
	if s.taskRunning {
		return false
	}
	s.taskRunning = true
	s.taskTarget = target
	s.taskStatus = "starting"
	s.taskMessage = "正在准备..."
	return true
}

func (s *ThemeService) releaseTask() {
	s.taskMu.Lock()
	defer s.taskMu.Unlock()
	s.taskRunning = false
}

var (
	rebuildStatus_ = "idle"
	rebuildMsg_    string
	rebuildMu      sync.Mutex
)

// RebuildStatus 查询 Blog 重建状态（前端轮询）
func (s *ThemeService) RebuildStatus() (string, string) {
	rebuildMu.Lock()
	defer rebuildMu.Unlock()
	return rebuildStatus_, rebuildMsg_
}

func setRebuildStatus(status, msg string) {
	rebuildMu.Lock()
	defer rebuildMu.Unlock()
	rebuildStatus_, rebuildMsg_ = status, msg
}

// rebuildIfActive 如果部署在原生环境，异步触发 Blog 重建
func (s *ThemeService) rebuildIfActive(slug string) {
	if getThemesDir() == "" {
		return
	}

	rebuildMu.Lock()
	if rebuildStatus_ == "rebuilding" {
		rebuildMu.Unlock()
		return
	}
	rebuildStatus_, rebuildMsg_ = "rebuilding", "正在重建 Blog..."
	rebuildMu.Unlock()

	// 尝试获取任务锁；获取失败说明已有任务执行中，跳过（该任务会处理重建）
	if !s.acquireTask("blog-rebuild") {
		return
	}

	go func() {
		defer s.releaseTask()

		blogDir := filepath.ToSlash(filepath.Join(os.Getenv("FLECBLOG_DIR"), "blog"))

		cmd := exec.Command("npm", "run", "build")
		cmd.Dir = blogDir
		cmd.Env = append(os.Environ(), "NODE_ENV=production", "NUXT_PUBLIC_ACTIVE_THEME="+slug)
		if err := cmd.Run(); err != nil {
			setRebuildStatus("error", "Blog 重建失败: "+err.Error())
			s.setTaskStatus("blog-rebuild", "error", "Blog 重建失败: "+err.Error())
			return
		}

		setRebuildStatus("done", "主题切换完成")
		s.setTaskStatus("blog-rebuild", "done", "主题切换完成")
	}()
}

// SyncThemeMetadata 启动时同步主题元数据：从磁盘读取 theme.config.json 覆盖开发者字段
func (s *ThemeService) SyncThemeMetadata(ctx context.Context) {
	themesDir := getThemesDir()
	if themesDir == "" {
		return
	}

	themes, err := s.repo.List(ctx)
	if err != nil {
		logger.Warn("同步主题元数据失败: %v", err)
		return
	}

	for _, theme := range themes {
		themeDir := filepath.Join(themesDir, theme.Slug)
		configPath := filepath.Join(themeDir, "theme.config.json")

		data, err := os.ReadFile(configPath) //nolint:gosec // G304 需要读取主题目录下的配置文件
		if err != nil {
			logger.Warn("主题 %s: 读取 theme.config.json 失败: %v", theme.Slug, err)
			continue
		}

		var config themeConfig
		if err := json.Unmarshal(data, &config); err != nil {
			logger.Warn("主题 %s: 解析 theme.config.json 失败: %v", theme.Slug, err)
			continue
		}

		updates := make(map[string]interface{})

		// 开发者字段始终从磁盘覆盖
		if config.Name != "" {
			updates["name"] = config.Name
		}
		if config.Version != "" {
			updates["version"] = config.Version
		}
		if config.Author != "" {
			updates["author"] = config.Author
		}
		if config.Description != "" {
			updates["description"] = config.Description
		}
		if config.License != "" {
			updates["license"] = config.License
		}
		if config.Repo != "" {
			updates["repo"] = config.Repo
		}
		if config.Cover != "" {
			updates["cover"] = config.Cover
		}

		// Schema 始终从磁盘覆盖
		schemaContent, err := readThemeSchema(configPath)
		if err != nil {
			logger.Warn("主题 %s: 读取 Schema 文件失败: %v", theme.Slug, err)
		} else {
			updates["schema"] = string(schemaContent)
		}

		// 用户数据仅在为空时初始化（不覆盖用户操作）
		if theme.Menus == "" || theme.Menus == "[]" {
			updates["menus"] = "{}"
		}

		if len(updates) == 0 {
			continue
		}

		if err := s.repo.UpdateMetadata(ctx, theme.Slug, updates); err != nil {
			logger.Warn("主题 %s: 更新元数据失败: %v", theme.Slug, err)
			continue
		}

		logger.Info("主题 %s: 元数据已从磁盘同步", theme.Slug)
	}
}

// ============ 查询服务 ============

// List 获取主题列表
func (s *ThemeService) List(ctx context.Context) ([]dto.ThemeListItem, error) {
	themes, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}

	market := s.fetchMarketThemes()
	marketMap := make(map[string]string, len(market))
	for _, m := range market {
		if m.Version != "" {
			marketMap[m.Slug] = m.Version
		}
	}

	result := make([]dto.ThemeListItem, 0, len(themes))
	for _, theme := range themes {
		item := dto.ThemeListItem{
			Slug:        theme.Slug,
			Name:        theme.Name,
			IsActive:    theme.IsActive,
			Version:     theme.Version,
			Author:      theme.Author,
			Description: theme.Description,
			Cover:       theme.Cover,
			License:     theme.License,
			Repo:        theme.Repo,
			CreatedAt:   theme.CreatedAt.Local().Format("2006-01-02 15:04:05"),
			UpdatedAt:   theme.UpdatedAt.Local().Format("2006-01-02 15:04:05"),
		}
		if latest, ok := marketMap[theme.Slug]; ok && theme.Version != "" {
			if cmp, _ := compareVersion(latest, theme.Version); cmp > 0 {
				item.LatestVersion = latest
			}
		}
		result = append(result, item)
	}
	return result, nil
}

// Get 获取单个主题详情
func (s *ThemeService) Get(ctx context.Context, slug string) (*dto.ThemeResponse, error) {
	theme, err := s.repo.Get(ctx, slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("主题不存在")
		}
		return nil, err
	}

	return &dto.ThemeResponse{
		Slug:        theme.Slug,
		Name:        theme.Name,
		IsActive:    theme.IsActive,
		Config:      json.RawMessage(theme.Config),
		Schema:      json.RawMessage(theme.Schema),
		Menus:       json.RawMessage(theme.Menus),
		Version:     theme.Version,
		Author:      theme.Author,
		Description: theme.Description,
		Cover:       theme.Cover,
		License:     theme.License,
		Repo:        theme.Repo,
		CreatedAt:   theme.CreatedAt.Local().Format("2006-01-02 15:04:05"),
		UpdatedAt:   theme.UpdatedAt.Local().Format("2006-01-02 15:04:05"),
	}, nil
}

// GetActiveSchema 获取当前激活主题的 Schema
func (s *ThemeService) GetActiveSchema(ctx context.Context) (*dto.ThemeSchemaResponse, error) {
	theme, err := s.repo.GetActive(ctx)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("没有激活的主题")
		}
		return nil, err
	}

	// 过滤掉 is_enabled=false 的菜单项
	menus, _ := s.GetMenusForWeb(theme.Slug)
	menusJSON, err := json.Marshal(menus)
	if err != nil {
		menusJSON = []byte("{}")
	}

	return &dto.ThemeSchemaResponse{
		Slug:   theme.Slug,
		Name:   theme.Name,
		Schema: json.RawMessage(theme.Schema),
		Config: json.RawMessage(theme.Config),
		Menus:  json.RawMessage(menusJSON),
	}, nil
}

// ============ 安装服务 ============

// themeConfig 主题配置文件结构
type themeConfig struct {
	Slug            string `json:"slug"`
	Name            string `json:"name"`
	Version         string `json:"version"`
	Author          string `json:"author"`
	Description     string `json:"description"`
	Cover           string `json:"cover"`
	License         string `json:"license"`
	Repo            string `json:"repo"`
	PremiumRequired bool   `json:"premium_required"`
}

// installFromExtractDir 从已解压的目录安装主题（ZIP 上传 / 主题市场下载 公共逻辑）
func (s *ThemeService) installFromExtractDir(ctx context.Context, extractDir string) (*dto.ThemeInstallResponse, error) {
	config, configPath, err := findAndValidateThemeConfig(extractDir)
	if err != nil {
		return nil, err
	}

	// 付费主题安装前检查会员状态
	if config.PremiumRequired && !s.premiumService.IsPremiumActive() {
		return nil, errors.New("此主题需要高级会员，请先前往会员页面激活")
	}

	schemaContent, err := readThemeSchema(configPath)
	if err != nil {
		return nil, fmt.Errorf("读取 Schema 失败: %w", err)
	}

	if err := validateSchemaFormat(schemaContent); err != nil {
		return nil, fmt.Errorf("schema 格式无效: %w", err)
	}

	themesDir := getThemesDir()
	if themesDir == "" {
		return nil, errors.New("FLECBLOG_DIR 未配置，无法安装主题")
	}

	themeDir := filepath.Join(themesDir, config.Slug)
	sourceDir := filepath.Dir(configPath)

	// 备份旧版本（如果存在）
	backupDir := themeDir + ".bak"
	hadBackup := false
	if _, statErr := os.Stat(themeDir); statErr == nil {
		if err := os.Rename(themeDir, backupDir); err != nil {
			return nil, fmt.Errorf("备份旧版本主题目录失败: %w", err)
		}
		hadBackup = true
	}

	// 复制新版本文件到目标目录
	if err := copyDir(sourceDir, themeDir, nil); err != nil {
		// 回滚：恢复备份
		if hadBackup {
			_ = os.RemoveAll(themeDir) // 清理失败的新文件
			_ = os.Rename(backupDir, themeDir)
		}
		return nil, fmt.Errorf("复制主题文件失败: %w", err)
	}

	// 处理主题名回退：如果未提供则使用 slug 作为默认显示名称
	themeName := config.Name
	if themeName == "" {
		themeName = config.Slug
	}

	theme := &model.ThemeInstance{
		Slug:        config.Slug,
		Name:        themeName,
		IsActive:    false,
		Config:      "{}",
		Schema:      string(schemaContent),
		Menus:       "{}",
		Version:     config.Version,
		Author:      config.Author,
		Description: config.Description,
		Cover:       config.Cover,
		License:     config.License,
		Repo:        config.Repo,
	}

	existing, err := s.repo.Get(ctx, config.Slug)
	if err == nil {
		theme.IsActive = existing.IsActive
		if existing.Name != "" {
			theme.Name = existing.Name // 主题名不可变
		}

		// 版本升级时执行 Schema 迁移
		if existing.Version != "" && existing.Version != config.Version {
			cmp, _ := compareVersion(config.Version, existing.Version)
			if cmp > 0 {
				migratedConfig, migErr := s.migrateConfig(configPath, existing.Config, existing.Version, config.Version)
				if migErr != nil {
					logger.Warn("主题 %s 配置迁移失败 (v%s → v%s): %v", config.Slug, existing.Version, config.Version, migErr)
					theme.Config = existing.Config
				} else {
					theme.Config = migratedConfig
					logger.Info("主题 %s 配置已从 v%s 迁移到 v%s", config.Slug, existing.Version, config.Version)
				}
			} else {
				// 降级安装：保留原配置但更新 schema
				theme.Config = existing.Config
				logger.Warn("主题 %s 版本降级 (v%s → v%s)，配置保留不迁移", config.Slug, existing.Version, config.Version)
			}
		} else {
			theme.Config = existing.Config
		}
	}

	// DB 写入
	if err := s.repo.Upsert(ctx, theme); err != nil {
		// 回滚：恢复备份，清理新文件
		_ = os.RemoveAll(themeDir)
		if hadBackup {
			_ = os.Rename(backupDir, themeDir)
		}
		return nil, fmt.Errorf("保存主题记录失败: %w", err)
	}

	// 全部成功，清理备份
	if hadBackup {
		_ = os.RemoveAll(backupDir)
	}

	// 覆盖安装已激活主题时需重建 Blog
	if theme.IsActive {
		s.rebuildIfActive(config.Slug)
	}

	return &dto.ThemeInstallResponse{
		Slug:     config.Slug,
		Name:     theme.Name,
		Version:  config.Version,
		IsActive: theme.IsActive,
		Message:  "主题安装成功",
	}, nil
}

// InstallFromMarket 从主题市场下载并安装（异步）
func (s *ThemeService) InstallFromMarket(slug string) error {
	if !s.acquireTask("theme-install") {
		return errors.New("有任务正在执行，请稍后再试")
	}

	go func() {
		defer s.releaseTask()
		s.setTaskStatus("theme-install", "downloading", fmt.Sprintf("正在从市场下载 %s...", slug))

		resp, err := s.panelClient.DoRawGet(context.Background(), "/api/themes/"+slug+"/download")
		if err != nil {
			s.setTaskStatus("theme-install", "error", "连接主题市场失败: "+err.Error())
			return
		}
		defer func() { _ = resp.Body.Close() }()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
			s.setTaskStatus("theme-install", "error", fmt.Sprintf("主题市场返回错误: %s", string(body)))
			return
		}

		data, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
		if err != nil {
			s.setTaskStatus("theme-install", "error", "读取主题包失败: "+err.Error())
			return
		}

		s.setTaskStatus("theme-install", "extracting", "正在解压主题包...")
		tempDir, err := os.MkdirTemp("", "theme-install-*")
		if err != nil {
			s.setTaskStatus("theme-install", "error", "创建临时目录失败: "+err.Error())
			return
		}
		defer func() { _ = os.RemoveAll(tempDir) }()

		if err := extractZip(data, tempDir); err != nil {
			s.setTaskStatus("theme-install", "error", "解压 ZIP 失败: "+err.Error())
			return
		}

		s.setTaskStatus("theme-install", "saving", "正在安装主题文件...")
		if _, err := s.installFromExtractDir(context.Background(), tempDir); err != nil {
			s.setTaskStatus("theme-install", "error", err.Error())
			return
		}

		s.setTaskStatus("theme-install", "done", "主题安装成功")
	}()

	return nil
}

// InstallFromZip 从 ZIP 文件安装主题（异步）
func (s *ThemeService) InstallFromZip(zipData []byte) error {
	if !s.acquireTask("theme-install") {
		return errors.New("有任务正在执行，请稍后再试")
	}

	go func() {
		defer s.releaseTask()

		s.setTaskStatus("theme-install", "extracting", "正在解压主题包...")
		tempDir, err := os.MkdirTemp("", "theme-install-*")
		if err != nil {
			s.setTaskStatus("theme-install", "error", "创建临时目录失败: "+err.Error())
			return
		}
		defer func() { _ = os.RemoveAll(tempDir) }()

		if err := extractZip(zipData, tempDir); err != nil {
			s.setTaskStatus("theme-install", "error", "解压 ZIP 失败: "+err.Error())
			return
		}

		s.setTaskStatus("theme-install", "saving", "正在安装主题文件...")
		if _, err := s.installFromExtractDir(context.Background(), tempDir); err != nil {
			s.setTaskStatus("theme-install", "error", err.Error())
			return
		}

		s.setTaskStatus("theme-install", "done", "主题安装成功")
	}()

	return nil
}

// Activate 激活主题（异步）
func (s *ThemeService) Activate(ctx context.Context, slug string) error {
	exists, err := s.repo.Exists(ctx, slug)
	if err != nil {
		return err
	}
	if !exists {
		return errors.New("主题不存在")
	}

	theme, err := s.repo.Get(ctx, slug)
	if err != nil {
		return err
	}
	if theme.PremiumRequired && !s.premiumService.IsPremiumActive() {
		return errors.New("此主题需要高级会员，请先前往会员页面激活")
	}

	active, err := s.repo.GetActive(ctx)
	if err == nil && active.Slug == slug {
		return errors.New("主题已处于激活状态")
	}

	if !s.acquireTask("theme-activate") {
		return errors.New("有任务正在执行，请稍后再试")
	}

	go func() {
		s.setTaskStatus("theme-activate", "activating", "正在激活主题...")
		if err := s.repo.ActivateTheme(context.Background(), slug); err != nil {
			s.setTaskStatus("theme-activate", "error", "激活主题失败: "+err.Error())
			s.releaseTask()
			return
		}
		s.releaseTask()

		s.rebuildIfActive(slug)
	}()

	return nil
}

// Delete 删除主题（磁盘文件 + 数据库记录）
func (s *ThemeService) Delete(ctx context.Context, slug string) error {
	theme, err := s.repo.Get(ctx, slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("主题不存在")
		}
		return err
	}
	if theme.IsActive {
		return errors.New("不能删除当前激活的主题")
	}

	// 删除磁盘文件
	themesDir := getThemesDir()
	if themesDir != "" {
		themeDir := filepath.Join(themesDir, slug)
		if err := os.RemoveAll(themeDir); err != nil {
			logger.Warn("删除主题目录失败: %v", err)
		}
	}

	// 标记主题关联文件为未使用
	if s.fileService != nil {
		uploadType := theme.Name
		if uploadType == "" {
			uploadType = slug
		}
		_ = s.fileService.MarkUnusedByTheme(uploadType)
	}

	// 删除数据库记录（menus JSON 随记录自动删除）
	return s.repo.Delete(ctx, slug)
}

// UpdateConfig 更新主题配置
func (s *ThemeService) UpdateConfig(ctx context.Context, slug string, config json.RawMessage) (json.RawMessage, error) {
	// 获取主题
	theme, err := s.repo.Get(ctx, slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("主题不存在")
		}
		return nil, err
	}

	// 更新配置
	configStr := string(config)
	if err := s.repo.UpdateConfig(ctx, slug, configStr); err != nil {
		return nil, fmt.Errorf("更新配置失败: %w", err)
	}

	// 处理图片字段变更
	uploadType := theme.Name
	if uploadType == "" {
		uploadType = slug
	}
	if s.fileService != nil {
		s.diffImages(uploadType, theme.Config, string(config), theme.Schema)
	}

	if theme.IsActive {
		s.rebuildIfActive(slug)
	}

	return config, nil
}

// diffImages 对比新旧配置中图片字段的 URL 变更，更新 FileService 引用计数
func (s *ThemeService) diffImages(uploadType, oldCfg, newCfg, schemaStr string) {
	// 从 Schema 中提取图片字段：扁平 key 集合 + 数组子字段映射
	flatKeys, arrayKeys := make(map[string]bool), make(map[string]string)
	if schemaStr != "" && schemaStr != "{}" {
		var schema map[string]interface{}
		if json.Unmarshal([]byte(schemaStr), &schema) == nil {
			var walk func(obj map[string]interface{})
			walk = func(obj map[string]interface{}) {
				for key, val := range obj {
					m, ok := val.(map[string]interface{})
					if !ok {
						continue
					}
					t, _ := m["type"].(string)
					if t == "" {
						walk(m)
						continue
					}
					if f, _ := m["format"].(string); f == "image" || f == "upload" {
						flatKeys[key] = true
					}
					if t == "array" {
						if items, _ := m["x-item-fields"].([]interface{}); items != nil {
							for _, item := range items {
								if im, ok := item.(map[string]interface{}); ok {
									if it, _ := im["type"].(string); it == "upload" {
										if ik, _ := im["key"].(string); ik != "" {
											arrayKeys[key] = ik
										}
									}
								}
							}
						}
					}
				}
			}
			walk(schema)
		}
	}

	var oldMap, newMap map[string]interface{}
	if json.Unmarshal([]byte(oldCfg), &oldMap) != nil || json.Unmarshal([]byte(newCfg), &newMap) != nil {
		return
	}

	oldSet, newSet := make(map[string]bool), make(map[string]bool)

	// 收集扁平图片字段的 URL
	for key := range flatKeys {
		if u, _ := oldMap[key].(string); u != "" {
			oldSet[u] = true
		}
		if u, _ := newMap[key].(string); u != "" {
			newSet[u] = true
		}
	}

	// 收集数组子字段的 URL
	for arrayKey, subKey := range arrayKeys {
		collectURLs(oldMap[arrayKey], subKey, oldSet)
		collectURLs(newMap[arrayKey], subKey, newSet)
	}

	// 新增的图片 → MarkAsUsed；删除的 → MarkAsUnused
	for u := range newSet {
		if !oldSet[u] {
			_ = s.fileService.MarkAsUsedWithType(u, uploadType)
		}
		delete(oldSet, u)
	}
	for u := range oldSet {
		_ = s.fileService.MarkAsUnused(u)
	}
}

// collectURLs 从数组/对象中递归提取子字段 subKey 的字符串值
func collectURLs(v interface{}, subKey string, set map[string]bool) {
	switch val := v.(type) {
	case map[string]interface{}:
		if u, _ := val[subKey].(string); u != "" {
			set[u] = true
		}
	case []interface{}:
		for _, item := range val {
			if m, ok := item.(map[string]interface{}); ok {
				if u, _ := m[subKey].(string); u != "" {
					set[u] = true
				}
			}
		}
	}
}

// ============ ZIP 解压函数 ============

// extractZip 解压 ZIP 文件到目标目录
func extractZip(data []byte, destDir string) error {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}

	for _, file := range reader.File {
		cleanPath := filepath.Clean(file.Name)
		if strings.Contains(cleanPath, "..") {
			return fmt.Errorf("ZIP 文件包含不安全的路径: %s", file.Name)
		}
		if filepath.IsAbs(cleanPath) {
			return fmt.Errorf("ZIP 文件包含绝对路径: %s", file.Name)
		}

		// #nosec G305 G703 G304 -- 已在上方验证路径安全性
		path := filepath.Join(destDir, file.Name)

		if file.FileInfo().IsDir() {
			// #nosec G703 -- 路径已在上方验证
			if err := os.MkdirAll(path, 0o750); err != nil {
				return err
			}
			continue
		}

		// #nosec G703 -- 路径已在上方验证
		if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
			return err
		}

		// #nosec G304 G703 -- 路径已在上方验证
		outFile, err := os.Create(path)
		if err != nil {
			return err
		}

		inFile, err := file.Open()
		if err != nil {
			_ = outFile.Close()
			return err
		}

		// #nosec G110 -- ZIP 解压，文件大小由服务器上下文控制
		_, err = io.Copy(outFile, inFile)
		_ = inFile.Close()
		_ = outFile.Close()
		if err != nil {
			return err
		}
	}

	return nil
}

// findAndValidateThemeConfig 查找并验证 theme.config.json
func findAndValidateThemeConfig(dir string) (*themeConfig, string, error) {
	var configPath string

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Name() == "theme.config.json" {
			configPath = path
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil {
		return nil, "", fmt.Errorf("搜索配置文件失败: %w", err)
	}
	if configPath == "" {
		return nil, "", errors.New("ZIP 包中缺少 theme.config.json 文件")
	}

	// #nosec G304 -- configPath 来自被管理的主题目录
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, "", fmt.Errorf("读取配置文件失败: %w", err)
	}

	var config themeConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, "", fmt.Errorf("解析配置文件失败: %w", err)
	}

	if config.Slug == "" {
		return nil, "", errors.New("theme.config.json 缺少 slug 字段")
	}
	if config.Version == "" {
		return nil, "", errors.New("theme.config.json 缺少 version 字段")
	}
	schemaPath := filepath.Join(filepath.Dir(configPath), "schemas", "config.json")
	if _, err := os.Stat(schemaPath); err != nil {
		return nil, "", errors.New("主题缺少 schemas/config.json 文件")
	}
	if config.Slug == "default" {
		return nil, "", errors.New("禁止使用 'default' 作为主题标识")
	}

	return &config, configPath, nil
}

// readThemeSchema 读取主题 Schema 文件（路径固定为 schemas/config.json）
func readThemeSchema(configPath string) (json.RawMessage, error) {
	schemaFile := filepath.Join(filepath.Dir(configPath), "schemas", "config.json")

	// #nosec G304 -- schemaFile 路径来自被管理的主题目录
	data, err := os.ReadFile(schemaFile)
	if err != nil {
		return nil, fmt.Errorf("读取 Schema 文件失败: %w", err)
	}

	if !json.Valid(data) {
		return nil, errors.New("schema 文件不是有效的 JSON 格式")
	}

	return json.RawMessage(data), nil
}

// validateSchemaFormat 验证 Schema 格式
func validateSchemaFormat(schema json.RawMessage) error {
	var schemaMap map[string]interface{}
	if err := json.Unmarshal(schema, &schemaMap); err != nil {
		return fmt.Errorf("schema 解析失败: %w", err)
	}

	if len(schemaMap) == 0 {
		return nil
	}

	props := schemaMap
	if p, ok := schemaMap["properties"]; ok {
		if props, ok = p.(map[string]interface{}); !ok {
			return errors.New("properties 必须是对象")
		}
	}

	var walk func(obj map[string]interface{}) error
	walk = func(obj map[string]interface{}) error {
		for key, val := range obj {
			if key == "groups" {
				continue
			}
			m, ok := val.(map[string]interface{})
			if !ok {
				return fmt.Errorf("属性 %s 必须是对象", key)
			}
			if typeVal, hasType := m["type"]; hasType {
				typeStr, ok := typeVal.(string)
				if !ok {
					return fmt.Errorf("属性 %s 的 type 必须是字符串", key)
				}
				validTypes := map[string]bool{
					"string": true, "boolean": true, "integer": true,
					"number": true, "array": true, "object": true,
				}
				if !validTypes[typeStr] {
					return fmt.Errorf("属性 %s 的 type '%s' 无效", key, typeStr)
				}
			} else {
				if err := walk(m); err != nil {
					return err
				}
			}
		}
		return nil
	}

	return walk(props)
}

// ============ 配置迁移 ============

// applyMigrations 对配置映射按版本顺序执行迁移操作
func applyMigrations(config map[string]interface{}, oldVersion, newVersion string, migrations []model.ThemeMigration) (map[string]interface{}, error) {
	if len(migrations) == 0 {
		return config, nil
	}

	// 浅拷贝，避免修改原始数据
	result := make(map[string]interface{}, len(config))
	for k, v := range config {
		result[k] = v
	}

	// 仅应用 oldVersion < version <= newVersion 的迁移
	for _, m := range migrations {
		cmpOld, _ := compareVersion(m.Version, oldVersion)
		if cmpOld <= 0 {
			continue
		}
		cmpNew, _ := compareVersion(m.Version, newVersion)
		if cmpNew > 0 {
			continue
		}

		for _, action := range m.Actions {
			switch action.Op {

			case "rename":
				// 若目标 key 已存在则跳过（保护用户数据）
				if _, targetExists := result[action.To]; !targetExists {
					if val, sourceExists := result[action.From]; sourceExists {
						result[action.To] = val
						delete(result, action.From)
					}
				}

			case "array_rename":
				applyArrayOp(result, action, func(itemMap map[string]interface{}) {
					if _, targetExists := itemMap[action.To]; !targetExists {
						if val, sourceExists := itemMap[action.From]; sourceExists {
							itemMap[action.To] = val
							delete(itemMap, action.From)
						}
					}
				})

			default:
				logger.Warn("未知的迁移操作: %s (版本 %s)", action.Op, m.Version)
			}
		}
	}

	return result, nil
}

// applyArrayOp 对配置中指定 key 的 JSON 数组逐项执行操作
func applyArrayOp(result map[string]interface{}, action model.MigrationAction, fn func(itemMap map[string]interface{})) {
	raw, ok := result[action.Key]
	if !ok {
		return
	}
	arr, ok := raw.([]interface{})
	if !ok {
		return
	}
	for i, item := range arr {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		fn(itemMap)
		arr[i] = itemMap
	}
	result[action.Key] = arr
}

// migrateConfig 执行完整的配置迁移流程（读取迁移文件 → 反序列化 → 应用 → 序列化）
func (s *ThemeService) migrateConfig(configPath, oldConfigStr, oldVersion, newVersion string) (string, error) {
	// 读取迁移文件
	migrationsPath := filepath.Join(filepath.Dir(configPath), "schemas", "migrations.json")
	var migrations []model.ThemeMigration
	if _, err := os.Stat(migrationsPath); err == nil {
		// #nosec G304 -- 路径来自被管理的主题目录
		data, err := os.ReadFile(migrationsPath)
		if err != nil {
			return "", fmt.Errorf("读取迁移文件失败: %w", err)
		}
		if err := json.Unmarshal(data, &migrations); err != nil {
			return "", fmt.Errorf("解析迁移文件失败: %w", err)
		}
	}
	if len(migrations) == 0 {
		return oldConfigStr, nil
	}

	var configMap map[string]interface{}
	if err := json.Unmarshal([]byte(oldConfigStr), &configMap); err != nil {
		return "", fmt.Errorf("解析旧配置失败: %w", err)
	}

	migrated, err := applyMigrations(configMap, oldVersion, newVersion, migrations)
	if err != nil {
		return "", err
	}

	data, err := json.Marshal(migrated)
	if err != nil {
		return "", fmt.Errorf("序列化迁移后配置失败: %w", err)
	}

	return string(data), nil
}

// ============ 菜单数据管理 ============

// parseMenusJSON 解析主题的 menus JSON 字段
func (s *ThemeService) parseMenusJSON(slug string) (map[string][]dto.MenuDataItem, error) {
	theme, err := s.repo.Get(context.Background(), slug)
	if err != nil {
		return nil, err
	}
	if theme.Menus == "" || theme.Menus == "{}" || theme.Menus == "[]" {
		return map[string][]dto.MenuDataItem{}, nil
	}
	var data map[string][]dto.MenuDataItem
	if err := json.Unmarshal([]byte(theme.Menus), &data); err != nil {
		return nil, fmt.Errorf("解析菜单数据失败: %w", err)
	}
	return data, nil
}

// assignMenuIDs 为新增的菜单项分配 ID（ID 为 0 的项自动分配）
func assignMenuIDs(items []dto.MenuDataItem, nextID *uint) {
	for i := range items {
		if items[i].ID == 0 {
			items[i].ID = *nextID
			*nextID++
		}
		if items[i].Children == nil {
			items[i].Children = []dto.MenuDataItem{}
		}
		assignMenuIDs(items[i].Children, nextID)
	}
}

// filterEnabledMenus 递归过滤掉 is_enabled=false 的菜单项
func filterEnabledMenus(items []dto.MenuDataItem) []dto.MenuDataItem {
	var result []dto.MenuDataItem
	for _, item := range items {
		if !item.IsEnabled {
			continue
		}
		filtered := item
		filtered.Children = filterEnabledMenus(item.Children)
		result = append(result, filtered)
	}
	return result
}

// collectIcons 递归收集菜单项中的图标 URL
func collectIcons(items []dto.MenuDataItem) []string {
	var icons []string
	for _, item := range items {
		if item.Icon != "" {
			icons = append(icons, item.Icon)
		}
		icons = append(icons, collectIcons(item.Children)...)
	}
	return icons
}

// GetMenus 获取主题菜单数据（按 type 过滤）
func (s *ThemeService) GetMenus(slug, menuType string) ([]dto.MenuDataItem, error) {
	data, err := s.parseMenusJSON(slug)
	if err != nil {
		return nil, err
	}
	if menuType != "" {
		return data[menuType], nil
	}
	// 不指定 type 时返回所有类型的平铺列表
	var all []dto.MenuDataItem
	for _, items := range data {
		all = append(all, items...)
	}
	return all, nil
}

// GetMenusForWeb 前台获取菜单（enabled-only，返回按 type 分组的完整结构）
func (s *ThemeService) GetMenusForWeb(slug string) (map[string][]dto.MenuDataItem, error) {
	data, err := s.parseMenusJSON(slug)
	if err != nil {
		return nil, err
	}
	result := make(map[string][]dto.MenuDataItem, len(data))
	for key, items := range data {
		filtered := filterEnabledMenus(items)
		if len(filtered) > 0 {
			result[key] = filtered
		}
	}
	return result, nil
}

// UpdateMenus 更新某个 type 的菜单列表（整体替换）
func (s *ThemeService) UpdateMenus(slug, menuType string, items []dto.MenuDataItem) error {
	data, err := s.parseMenusJSON(slug)
	if err != nil {
		return err
	}
	// 收集旧图标用于标记未使用
	oldIcons := collectIcons(data[menuType])

	// 分配新 ID（遍历所有 type 的所有项取 max+1）
	var maxID uint
	var walkItems func(items []dto.MenuDataItem)
	walkItems = func(items []dto.MenuDataItem) {
		for _, item := range items {
			if item.ID > maxID {
				maxID = item.ID
			}
			walkItems(item.Children)
		}
	}
	for _, items := range data {
		walkItems(items)
	}
	nextID := maxID + 1
	assignMenuIDs(items, &nextID)

	data[menuType] = items

	menusRaw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if err := s.repo.UpdateMetadata(context.Background(), slug, map[string]interface{}{"menus": string(menusRaw)}); err != nil {
		return err
	}

	// 处理图标引用变化
	if s.fileService != nil {
		newIcons := collectIcons(items)
		newIconSet := make(map[string]bool, len(newIcons))
		for _, icon := range newIcons {
			newIconSet[icon] = true
		}
		for _, icon := range oldIcons {
			if !newIconSet[icon] {
				_ = s.fileService.MarkAsUnused(icon)
			}
		}
		for _, icon := range newIcons {
			_ = s.fileService.MarkAsUsed(icon)
		}
	}

	return nil
}
