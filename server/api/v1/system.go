package v1

import (
	"flec_blog/internal/dto"
	"flec_blog/internal/service"
	"flec_blog/pkg/response"

	"github.com/gin-gonic/gin"
)

// SystemController 系统信息控制器
type SystemController struct {
	systemService *service.SystemService
}

// NewSystemController 创建系统信息控制器
func NewSystemController(systemService *service.SystemService) *SystemController {
	return &SystemController{systemService: systemService}
}

// GetSystemStatic 获取系统静态信息
//
//	@Summary		系统静态信息
//	@Description	获取系统静态配置信息，页面加载时更新一次
//	@Tags			系统管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response.Response{data=dto.SystemStaticInfo}
//	@Router			/admin/system/static [get]
func (h *SystemController) GetSystemStatic(c *gin.Context) {
	response.Success(c, h.systemService.GetStaticInfo())
}

// GetSystemDynamic 获取系统动态信息
//
//	@Summary		系统动态信息
//	@Description	获取系统运行时动态信息，每10秒更新一次
//	@Tags			系统管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response.Response{data=dto.SystemDynamicInfo}
//	@Router			/admin/system/dynamic [get]
func (h *SystemController) GetSystemDynamic(c *gin.Context) {
	response.Success(c, h.systemService.GetDynamicInfo())
}

// CheckUpdate 检查版本更新
//
//	@Summary		检查版本更新
//	@Description	检查是否有新版本，如有更新则返回版本列表
//	@Tags			系统管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response.Response{data=dto.CheckUpdateResponse}
//	@Router			/admin/system/check-update [post]
func (h *SystemController) CheckUpdate(c *gin.Context) {
	result := h.systemService.CheckUpdate(c.Request.Context())
	response.Success(c, result)
}

// Upgrade 执行系统升级
//
//	@Summary		系统升级
//	@Description	异步执行系统升级（blog/server/all），通过 status 端点轮询进度
//	@Tags			系统管理
//	@Accept			json
//	@Produce		json
//	@Param			body	body	dto.UpgradeRequest	true	"升级目标"
//	@Security		BearerAuth
//	@Success		200	{object}	response.Response
//	@Router			/admin/system/upgrade [post]
func (h *SystemController) Upgrade(c *gin.Context) {
	var req dto.UpgradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ValidateFailed(c, "参数错误: "+err.Error())
		return
	}

	status := h.systemService.GetVersionStatus()
	if len(status.LatestVersions) == 0 {
		response.Failed(c, "请先检查更新，获取目标版本信息")
		return
	}

	if err := service.StartUpgrade(req.Target, status.LatestVersions[0].Version); err != nil {
		response.Failed(c, err.Error())
		return
	}

	response.Success(c, nil, "升级任务已启动")
}

// GetUpgradeStatus 查询升级进度
//
//	@Summary		查询升级进度
//	@Description	轮询升级进度，status=done 或 status=idle 表示完成
//	@Tags			系统管理
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response.Response{data=dto.UpgradeStatus}
//	@Router			/admin/system/upgrade/status [get]
func (h *SystemController) GetUpgradeStatus(c *gin.Context) {
	response.Success(c, service.GetUpgradeStatus())
}
