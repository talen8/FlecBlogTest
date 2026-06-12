package main

import (
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/subosito/gotenv"

	"flec_blog/api/middleware"
	"flec_blog/api/router"
	v1 "flec_blog/api/v1"
	"flec_blog/config"
	"flec_blog/internal/service"
	"flec_blog/pkg/database"
	"flec_blog/pkg/logger"
	"flec_blog/pkg/utils"

	_ "flec_blog/docs" // swagger docs
)

// @title           FlecBlog
// @version         v1
// @description     一个基于 Go 语言的现代化博客后端服务

// @contact.name   Talen
// @contact.email  talen2004@163.com

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description 在请求头中添加 Bearer Token，格式：Bearer {token}

func main() {
	// 加载 .env 文件
	_ = gotenv.Load()

	// 加载配置
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if cfg.IsSetupNeeded() {
		startSetupServer(cfg)
		return
	}

	// 初始化数据库连接
	db, err := database.NewDB(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 执行数据库迁移
	if err := database.RunMigrations(db.DB); err != nil {
		middleware.ClosePanicLogFile()
		logger.Close()
		_ = db.Close()
		log.Fatalf("Failed to run migrations: %v", err)
	}

	defer func() {
		_ = db.Close()
	}()
	defer logger.Close()
	defer middleware.ClosePanicLogFile()

	// 从数据库加载运行时配置（邮箱、上传等）
	settingService := service.NewSettingService(db.DB)
	settingService.SetConfig(cfg)               // 设置全局配置对象，用于热重载
	_ = settingService.ApplyDatabaseConfig(cfg) // 应用数据库配置

	// 初始化 IP 地理位置
	_ = utils.InitIPSearcher("")

	// 初始化路由
	r := router.InitRouter(db, cfg)

	// 安装向导轮询端点（正常模式返回 setup_needed: false）
	setupCtrl := v1.NewSetupController(cfg, ".")
	r.GET("/api/v1/setup/status", setupCtrl.GetStatus)

	// 注册 Admin 静态文件服务（原生部署，Admin 嵌入二进制）
	serveAdminStatic(r)

	// 初始化升级模块（清理旧二进制）
	service.InitUpgrade()

	// 启动服务器
	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Server.Port)
	logger.Info("Server is running at http://localhost:%d", cfg.Server.Port)
	if err := r.Run(addr); err != nil {
		utils.CloseIPSearcher()
		logger.Warn("Server stopped: %v", err)
	}
	utils.CloseIPSearcher()
}

// startSetupServer 启动首次安装模式（无数据库依赖）
func startSetupServer(cfg *config.Config) {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(middleware.CORS(cfg), middleware.Logger(), middleware.Recovery())

	// 提供嵌入式 setup 页面
	serveSetupStatic(r)

	// API 路由
	setupCtrl := v1.NewSetupController(cfg, ".")
	setupAPI := r.Group("/api/v1/setup")
	{
		setupAPI.GET("/status", setupCtrl.GetStatus)
		setupAPI.POST("/database", setupCtrl.SaveDatabase)
	}

	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Server.Port)
	logger.Info("FlecBlog is in setup mode at http://localhost:%d", cfg.Server.Port)
	logger.Info("Visit http://localhost:%d/setup/ to configure the system", cfg.Server.Port)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start setup server: %v", err)
	}
}

// serveSetupStatic 注册 Setup 引导页静态文件服务
func serveSetupStatic(r *gin.Engine) {
	subFS, err := fs.Sub(setupFS, "setup")
	if err != nil {
		log.Printf("未找到 Setup 嵌入资源: %v", err)
		return
	}

	r.StaticFS("/setup", http.FS(subFS))
}

// serveAdminStatic 注册 Admin 静态文件服务（仅当 adminFS 非空时生效）
func serveAdminStatic(r *gin.Engine) {
	subFS, err := fs.Sub(adminFS, "admin")
	if err != nil {
		return // Docker 模式下不注册
	}

	fileServer := http.FileServer(http.FS(subFS))

	serveIndex := func(c *gin.Context) {
		c.Request.URL.Path = "/admin/index.html"
		fileServer.ServeHTTP(c.Writer, c.Request)
	}

	r.GET("/admin", serveIndex)

	r.GET("/admin/*path", func(c *gin.Context) {
		path := strings.TrimPrefix(c.Request.URL.Path, "/admin/")
		if path == "" {
			serveIndex(c)
			return
		}
		// SPA fallback: 文件不存在时回退到 index.html
		if _, err := subFS.Open(path); err != nil {
			serveIndex(c)
			return
		}
		fileServer.ServeHTTP(c.Writer, c.Request)
	})
}
