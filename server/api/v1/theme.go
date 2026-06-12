package v1

import (
	"io"
	"net/http"
	"path/filepath"

	"flec_blog/internal/dto"
	"flec_blog/internal/service"
	"flec_blog/pkg/response"

	"github.com/gin-gonic/gin"
)

// ThemeController 主题控制器
type ThemeController struct {
	themeService *service.ThemeService
}

// NewThemeController 创建主题控制器
func NewThemeController(themeService *service.ThemeService) *ThemeController {
	return &ThemeController{themeService: themeService}
}

// ============ 前台接口 ============

// GetActiveSchema 获取当前激活主题的 Schema 和 Config
//
//	@Summary		获取激活主题 Schema 和 Config
//	@Description	获取当前激活主题的 schema 和 config（Blog 端使用）
//	@Tags			主题
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	response.Response
//	@Failure		404	{object}	response.Response
//	@Router			/themes/active/schema [get]
func (c *ThemeController) GetActiveSchema(ctx *gin.Context) {
	result, err := c.themeService.GetActiveSchema(ctx.Request.Context())
	if err != nil {
		response.NotFound(ctx, err.Error())
		return
	}

	response.Success(ctx, result)
}

// ============ 后台管理接口 ============

// TODO: 未来开放用户直接上传 ZIP 安装主题
// InstallFromZip 从 ZIP 文件安装主题（目前仅主题市场内部调用）
//
//	@Summary		安装主题
//	@Description	从 ZIP 文件安装主题（主题市场内部调用）
//	@Tags			主题管理
//	@Accept			multipart/form-data
//	@Produce		json
//	@Security		BearerAuth
//	@Param			file	formData	file	true	"主题 ZIP 包（≤50MB）"
//	@Success		200		{object}	response.Response{data=dto.ThemeInstallResponse}
//	@Failure		400		{object}	response.Response
//	@Failure		401		{object}	response.Response
//	@Failure		403		{object}	response.Response
//	@Router			/admin/themes/install [post]
func (c *ThemeController) InstallFromZip(ctx *gin.Context) {
	file, header, err := ctx.Request.FormFile("file")
	if err != nil {
		response.ValidateFailed(ctx, "请选择要安装的主题文件")
		return
	}
	defer func() { _ = file.Close() }()

	if filepath.Ext(header.Filename) != ".zip" {
		response.ValidateFailed(ctx, "只支持 ZIP 格式的主题包")
		return
	}

	const maxSize = 50 * 1024 * 1024
	if header.Size > maxSize {
		response.ValidateFailed(ctx, "文件大小不能超过 50MB")
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		response.Failed(ctx, "读取文件失败")
		return
	}

	if err := c.themeService.InstallFromZip(data); err != nil {
		response.Failed(ctx, err.Error())
		return
	}

	response.Success(ctx, nil)
}

// List 获取主题列表
//
//	@Summary		主题列表
//	@Description	获取所有已注册的主题
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response.Response
//	@Failure		401	{object}	response.Response
//	@Failure		403	{object}	response.Response
//	@Router			/admin/themes [get]
func (c *ThemeController) List(ctx *gin.Context) {
	themes, err := c.themeService.List(ctx.Request.Context())
	if err != nil {
		response.Failed(ctx, err.Error())
		return
	}

	response.Success(ctx, themes)
}

// Get 获取主题详情
//
//	@Summary		主题详情
//	@Description	获取指定主题的完整信息
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			slug	path		string	true	"主题标识"
//	@Success		200		{object}	response.Response
//	@Failure		401		{object}	response.Response
//	@Failure		403		{object}	response.Response
//	@Failure		404		{object}	response.Response
//	@Router			/admin/themes/{slug} [get]
func (c *ThemeController) Get(ctx *gin.Context) {
	slug := ctx.Param("slug")
	if slug == "" {
		response.ValidateFailed(ctx, "主题标识不能为空")
		return
	}

	theme, err := c.themeService.Get(ctx.Request.Context(), slug)
	if err != nil {
		response.NotFound(ctx, err.Error())
		return
	}

	response.Success(ctx, theme)
}

// Activate 激活主题
//
//	@Summary		激活主题
//	@Description	将指定主题设为激活状态
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			slug	path		string	true	"主题标识"
//	@Success		200		{object}	response.Response{data=dto.ThemeActivateResponse}
//	@Failure		401		{object}	response.Response
//	@Failure		403		{object}	response.Response
//	@Failure		404		{object}	response.Response
//	@Router			/admin/themes/{slug}/activate [post]
func (c *ThemeController) Activate(ctx *gin.Context) {
	slug := ctx.Param("slug")
	if slug == "" {
		response.ValidateFailed(ctx, "主题标识不能为空")
		return
	}

	if err := c.themeService.Activate(ctx.Request.Context(), slug); err != nil {
		response.Failed(ctx, err.Error())
		return
	}

	response.Success(ctx, nil)
}

// Delete 删除主题
//
//	@Summary		删除主题
//	@Description	删除指定的非激活主题（磁盘文件 + 数据库记录）
//	@Tags			主题管理
//	@Produce		json
//	@Security		BearerAuth
//	@Param			slug	path		string	true	"主题标识"
//	@Success		200		{object}	response.Response
//	@Failure		400		{object}	response.Response
//	@Failure		401		{object}	response.Response
//	@Failure		403		{object}	response.Response
//	@Router			/admin/themes/{slug} [delete]
func (c *ThemeController) Delete(ctx *gin.Context) {
	slug := ctx.Param("slug")
	if slug == "" {
		response.ValidateFailed(ctx, "主题标识不能为空")
		return
	}

	if err := c.themeService.Delete(ctx.Request.Context(), slug); err != nil {
		response.Failed(ctx, err.Error())
		return
	}

	response.Success(ctx, nil)
}

// UpdateConfig 更新主题配置
//
//	@Summary		更新主题配置
//	@Description	更新指定主题的配置
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			slug		path		string		true	"主题标识"
//	@Param			request		body		object		true	"主题配置"
//	@Success		200			{object}	response.Response
//	@Failure		400			{object}	response.Response
//	@Failure		401			{object}	response.Response
//	@Failure		403			{object}	response.Response
//	@Failure		404			{object}	response.Response
//	@Router			/admin/themes/{slug}/config [put]
func (c *ThemeController) UpdateConfig(ctx *gin.Context) {
	slug := ctx.Param("slug")
	if slug == "" {
		response.ValidateFailed(ctx, "主题标识不能为空")
		return
	}

	var req dto.ThemeConfigUpdateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ValidateFailed(ctx, err.Error())
		return
	}

	result, err := c.themeService.UpdateConfig(ctx.Request.Context(), slug, req.Config)
	if err != nil {
		response.Failed(ctx, err.Error())
		return
	}

	response.Success(ctx, result)
}

// ============ Blog 重建状态查询 ============

// GetBlogRebuildStatus 查询 Blog 重建状态（前端轮询）
//
//	@Summary		查询 Blog 重建状态
//	@Description	主题切换/更新后触发 Blog 重建，前端轮询此接口获取进度
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response.Response
//	@Router			/admin/themes/blog-rebuild-status [get]
func (c *ThemeController) GetBlogRebuildStatus(ctx *gin.Context) {
	status, msg := c.themeService.RebuildStatus()
	ctx.JSON(http.StatusOK, gin.H{"status": status, "message": msg})
}

// ============ 主题市场安装 ============

// InstallFromMarket 从市场下载并安装主题
//
//	@Summary		从市场安装主题
//	@Description	从主题市场下载并安装指定主题
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			slug	path		string	true	"主题标识"
//	@Success		200		{object}	response.Response{data=dto.ThemeInstallResponse}
//	@Failure		400		{object}	response.Response
//	@Failure		401		{object}	response.Response
//	@Failure		403		{object}	response.Response
//	@Failure		404		{object}	response.Response
//	@Router			/admin/themes/{slug}/market-install [post]
func (c *ThemeController) InstallFromMarket(ctx *gin.Context) {
	slug := ctx.Param("slug")
	if slug == "" {
		response.ValidateFailed(ctx, "主题标识不能为空")
		return
	}

	if err := c.themeService.InstallFromMarket(slug); err != nil {
		response.Failed(ctx, err.Error())
		return
	}

	response.Success(ctx, nil)
}

// ============ 任务状态 ============

// GetTaskStatus 获取当前主题相关任务状态
//
//	@Summary		获取任务状态
//	@Description	获取当前正在进行的主题任务状态（安装/升级/激活/重建）
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	response.Response{data=dto.TaskStatusResponse}
//	@Router			/admin/themes/task-status [get]
func (c *ThemeController) GetTaskStatus(ctx *gin.Context) {
	status := c.themeService.TaskStatus()
	response.Success(ctx, status)
}

// ============ 菜单数据接口 ============

// GetMenus 获取主题菜单
//
//	@Summary		获取主题菜单
//	@Description	获取指定主题的菜单数据，支持按类型筛选
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			slug	path		string	true	"主题标识"
//	@Param			type	query		string	false	"菜单类型"
//	@Success		200		{object}	response.Response{data=[]dto.MenuDataItem}
//	@Failure		401		{object}	response.Response
//	@Failure		403		{object}	response.Response
//	@Failure		404		{object}	response.Response
//	@Router			/admin/themes/{slug}/menus [get]
func (c *ThemeController) GetMenus(ctx *gin.Context) {
	slug := ctx.Param("slug")
	if slug == "" {
		response.ValidateFailed(ctx, "主题标识不能为空")
		return
	}
	menuType := ctx.Query("type")
	items, err := c.themeService.GetMenus(slug, menuType)
	if err != nil {
		response.Failed(ctx, err.Error())
		return
	}
	if items == nil {
		items = []dto.MenuDataItem{}
	}
	response.Success(ctx, items)
}

// UpdateMenus 更新主题菜单
//
//	@Summary		更新主题菜单
//	@Description	整体替换指定主题某个类型的菜单列表
//	@Tags			主题管理
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			slug	path		string					true	"主题标识"
//	@Param			request	body		dto.MenuUpdateRequest	true	"菜单数据"
//	@Success		200		{object}	response.Response
//	@Failure		400		{object}	response.Response
//	@Failure		401		{object}	response.Response
//	@Failure		403		{object}	response.Response
//	@Router			/admin/themes/{slug}/menus [put]
func (c *ThemeController) UpdateMenus(ctx *gin.Context) {
	slug := ctx.Param("slug")
	if slug == "" {
		response.ValidateFailed(ctx, "主题标识不能为空")
		return
	}
	var req dto.MenuUpdateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		response.ValidateFailed(ctx, err.Error())
		return
	}
	if err := c.themeService.UpdateMenus(slug, req.Type, req.Items); err != nil {
		response.Failed(ctx, err.Error())
		return
	}
	response.Success(ctx, nil)
}
