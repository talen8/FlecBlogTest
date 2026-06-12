package dto

import "encoding/json"

// ============ 主题响应 ============

// ThemeResponse 主题响应
type ThemeResponse struct {
	Slug        string          `json:"slug"`
	Name        string          `json:"name"`
	IsActive    bool            `json:"is_active"`
	Config      json.RawMessage `json:"config"`
	Schema      json.RawMessage `json:"schema"`
	Menus       json.RawMessage `json:"menus"`
	Version     string          `json:"version"`
	Author      string          `json:"author"`
	Description string          `json:"description"`
	Cover       string          `json:"cover"`
	License     string          `json:"license"`
	Repo        string          `json:"repo"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

// ThemeListItem 主题列表项
type ThemeListItem struct {
	Slug          string `json:"slug"`
	Name          string `json:"name"`
	IsActive      bool   `json:"is_active"`
	Version       string `json:"version"`
	LatestVersion string `json:"latest_version,omitempty"`
	Author        string `json:"author"`
	Description   string `json:"description"`
	Cover         string `json:"cover"`
	License       string `json:"license"`
	Repo          string `json:"repo"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

// ThemeActivateResponse 主题激活响应
type ThemeActivateResponse struct {
	Slug    string `json:"slug"`
	Name    string `json:"name"`
	Message string `json:"message"`
}

// ThemeConfigUpdateRequest 更新主题配置请求
type ThemeConfigUpdateRequest struct {
	Config json.RawMessage `json:"config" binding:"required"`
}

// ThemeSchemaResponse 主题 Schema 响应（公开）
type ThemeSchemaResponse struct {
	Slug   string          `json:"slug"`
	Name   string          `json:"name"`
	Schema json.RawMessage `json:"schema"`
	Config json.RawMessage `json:"config"`
	Menus  json.RawMessage `json:"menus"`
}

// ThemeInstallResponse 主题安装响应
type ThemeInstallResponse struct {
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	Version  string `json:"version"`
	IsActive bool   `json:"is_active"`
	Message  string `json:"message"`
}

// ============ 菜单数据 ============

// MenuDataItem 菜单项
type MenuDataItem struct {
	ID        uint           `json:"id"`
	Title     string         `json:"title"`
	URL       string         `json:"url"`
	Icon      string         `json:"icon"`
	Sort      int            `json:"sort"`
	IsEnabled bool           `json:"is_enabled"`
	Children  []MenuDataItem `json:"children"`
}

// MenuUpdateRequest 更新菜单请求
type MenuUpdateRequest struct {
	Type  string         `json:"type" binding:"required,max=50"`
	Items []MenuDataItem `json:"items" binding:"required"`
}

// ============ 任务状态 ============

// TaskStatusResponse 任务状态响应（主题安装/升级/激活/重建）
type TaskStatusResponse struct {
	Target  string `json:"target"`
	Status  string `json:"status"`
	Message string `json:"message"`
}
