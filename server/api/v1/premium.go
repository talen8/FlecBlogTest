package v1

import (
	"flec_blog/internal/dto"
	"flec_blog/internal/service"
	"flec_blog/pkg/response"

	"github.com/gin-gonic/gin"
)

// PremiumController 会员控制器
type PremiumController struct {
	premiumService *service.PremiumService
}

// NewPremiumController 创建会员控制器实例
func NewPremiumController(premiumService *service.PremiumService) *PremiumController {
	return &PremiumController{premiumService: premiumService}
}

// GetStatus 查询当前站点会员状态
//
//	@Summary		查询会员状态
//	@Description	获取当前站点的会员状态信息（包含完整字段，仅管理后台用）
//	@Tags			会员
//	@Success		200	{object}	response.Response{data=dto.PremiumStatusResponse}
//	@Failure		400	{object}	response.Response
//	@Router			/api/v1/admin/premium/status [get]
func (c *PremiumController) GetStatus(ctx *gin.Context) {
	status, err := c.premiumService.GetStatus(ctx.Request.Context())
	if err != nil {
		response.Failed(ctx, "查询会员状态失败: "+err.Error())
		return
	}
	response.Success(ctx, status)
}

// Activate 激活会员
//
//	@Summary		激活会员
//	@Description	用户输入激活码，Server 调 Panel 验证后累加会员时间
//	@Tags			会员
//	@Accept			json
//	@Produce		json
//	@Param			body	body		dto.PremiumActivateRequest	true	"激活请求"
//	@Success		200		{object}	response.Response{data=dto.PremiumStatusResponse}
//	@Failure		400		{object}	response.Response
//	@Router			/api/v1/admin/premium/activate [post]
func (c *PremiumController) Activate(ctx *gin.Context) {
	var req dto.PremiumActivateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ValidateFailed(ctx, "参数错误: "+err.Error())
		return
	}

	status, err := c.premiumService.Activate(ctx.Request.Context(), req.Code)
	if err != nil {
		response.Failed(ctx, err.Error())
		return
	}
	response.Success(ctx, status, "会员激活成功")
}
