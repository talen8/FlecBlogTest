package v1

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"flec_blog/config"
	"flec_blog/pkg/database"
	"flec_blog/pkg/errcode"
	"flec_blog/pkg/response"

	"github.com/gin-gonic/gin"
)

type SetupController struct {
	cfg *config.Config
	dir string // .env 所在目录
}

func NewSetupController(cfg *config.Config, dir string) *SetupController {
	return &SetupController{cfg: cfg, dir: dir}
}

// GetStatus 查询安装状态
func (h *SetupController) GetStatus(c *gin.Context) {
	response.Success(c, gin.H{
		"setup_needed": h.cfg.IsSetupNeeded(),
	})
}

// SaveDatabase 保存数据库配置并测试连接
func (h *SetupController) SaveDatabase(c *gin.Context) {
	var req struct {
		Host      string `json:"host"`
		Port      int    `json:"port"`
		Name      string `json:"name"`
		User      string `json:"user"`
		Password  string `json:"password"`
		JWTSecret string `json:"jwt_secret"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, errcode.InvalidParams)
		return
	}

	if req.Host == "" {
		req.Host = "localhost"
	}
	if req.Port == 0 {
		req.Port = 5432
	}
	if req.Name == "" {
		req.Name = "flecblog"
	}
	if req.User == "" {
		req.User = "postgres"
	}
	if req.JWTSecret == "" {
		response.ValidateFailed(c, "JWT 密钥不能为空")
		return
	}

	// 测试数据库连接
	dbConfig := config.DatabaseConfig{
		Host:     req.Host,
		Port:     req.Port,
		User:     req.User,
		Password: req.Password,
		DBName:   req.Name,
	}
	if err := testDBConnection(&dbConfig); err != nil {
		response.ValidateFailed(c, fmt.Sprintf("数据库连接失败: %v", err))
		return
	}

	// 仅测试模式（步骤 1），不写入 .env
	if req.JWTSecret == "_test_" {
		response.Success(c, gin.H{"message": "数据库连接成功"})
		return
	}

	// 写入 .env（步骤 2）
	envFile := filepath.Join(h.dir, ".env")
	content := fmt.Sprintf(`SERVER_PORT=8080
SERVER_ALLOW_ORIGINS=*
UPLOAD_DIR=./uploads
DB_HOST=%s
DB_PORT=%d
DB_NAME=%s
DB_USER=%s
DB_PASSWORD=%s
JWT_SECRET=%s
`, req.Host, req.Port, req.Name, req.User, req.Password, req.JWTSecret)

	if err := os.WriteFile(envFile, []byte(content), 0600); err != nil {
		response.Error(c, errcode.ServerError)
		return
	}

	response.Success(c, gin.H{
		"message":     "数据库配置已保存",
		"need_reboot": true,
	})

	// 安排服务重启：让响应发送后自动退出，PM2/Docker 会自动重新拉起
	go func() {
		time.Sleep(1 * time.Second)
		os.Exit(0)
	}()
}

func testDBConnection(dbCfg *config.DatabaseConfig) error {
	db, err := database.NewDB(dbCfg)
	if err != nil {
		return err
	}
	_ = db.Close()
	return nil
}
