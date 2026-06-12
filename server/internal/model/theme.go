package model

import "time"

// ThemeInstance 主题实例配置表
type ThemeInstance struct {
	Slug            string    `gorm:"primaryKey;type:text" json:"slug"`
	Name            string    `gorm:"type:text;default:''" json:"name"`
	IsActive        bool      `gorm:"default:false" json:"is_active"`
	Config          string    `gorm:"type:json" json:"config"`
	Schema          string    `gorm:"type:json" json:"schema"`
	Menus           string    `gorm:"type:json" json:"menus"`
	Version         string    `gorm:"type:text" json:"version"`
	Author          string    `gorm:"type:text;default:''" json:"author"`
	Description     string    `gorm:"type:text;default:''" json:"description"`
	Cover           string    `gorm:"type:text;default:''" json:"cover"`
	License         string    `gorm:"type:text;default:''" json:"license"`
	Repo            string    `gorm:"type:text;default:''" json:"repo"`
	PremiumRequired bool      `gorm:"default:false" json:"premium_required"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ThemeMigration 主题配置迁移步骤，对应 schemas/migrations.json 的单个条目
type ThemeMigration struct {
	Version     string            `json:"version"`
	Description string            `json:"description,omitempty"`
	Actions     []MigrationAction `json:"actions"`
}

// MigrationAction 单个迁移操作
type MigrationAction struct {
	Op   string `json:"op"`             // rename（字段重命名） | array_rename（数组项子字段重命名）
	Key  string `json:"key,omitempty"`  // array_rename 的数组字段名
	From string `json:"from,omitempty"` // 源字段名
	To   string `json:"to,omitempty"`   // 目标字段名
}
