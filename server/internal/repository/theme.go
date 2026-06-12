package repository

import (
	"context"

	"flec_blog/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ThemeRepository 主题仓储
type ThemeRepository struct {
	db *gorm.DB
}

// NewThemeRepository 创建主题仓储
func NewThemeRepository(db *gorm.DB) *ThemeRepository {
	return &ThemeRepository{db: db}
}

// ============ 基础CRUD ============

// List 获取主题列表
func (r *ThemeRepository) List(ctx context.Context) ([]model.ThemeInstance, error) {
	var themes []model.ThemeInstance
	err := r.db.WithContext(ctx).Order("is_active DESC, name ASC").Find(&themes).Error
	return themes, err
}

// Get 获取单个主题
func (r *ThemeRepository) Get(ctx context.Context, slug string) (*model.ThemeInstance, error) {
	var theme model.ThemeInstance
	err := r.db.WithContext(ctx).Where("slug = ?", slug).First(&theme).Error
	if err != nil {
		return nil, err
	}
	return &theme, nil
}

// GetActive 获取当前激活的主题
func (r *ThemeRepository) GetActive(ctx context.Context) (*model.ThemeInstance, error) {
	var theme model.ThemeInstance
	err := r.db.WithContext(ctx).Where("is_active = ?", true).First(&theme).Error
	if err != nil {
		return nil, err
	}
	return &theme, nil
}

// UpdateConfig 更新主题配置
func (r *ThemeRepository) UpdateConfig(ctx context.Context, slug string, config string) error {
	return r.db.WithContext(ctx).
		Model(&model.ThemeInstance{}).
		Where("slug = ?", slug).
		Update("config", config).Error
}

// Exists 检查主题是否存在
func (r *ThemeRepository) Exists(ctx context.Context, slug string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.ThemeInstance{}).
		Where("slug = ?", slug).
		Count(&count).Error
	return count > 0, err
}

// ActivateTheme 激活主题（在事务中完成）
func (r *ThemeRepository) ActivateTheme(ctx context.Context, slug string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 先取消所有主题的激活状态
		if err := tx.Model(&model.ThemeInstance{}).
			Where("is_active = ?", true).
			Update("is_active", false).Error; err != nil {
			return err
		}

		// 激活目标主题
		result := tx.Model(&model.ThemeInstance{}).
			Where("slug = ?", slug).
			Update("is_active", true)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

		return nil
	})
}

// Upsert 创建或更新主题（用于安装/升级）
func (r *ThemeRepository) Upsert(ctx context.Context, theme *model.ThemeInstance) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "slug"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "config", "schema", "version", "author", "description", "cover", "license", "repo", "premium_required", "updated_at"}),
		}).
		Create(theme).Error
}

// Delete 删除主题记录
func (r *ThemeRepository) Delete(ctx context.Context, slug string) error {
	return r.db.WithContext(ctx).
		Where("slug = ?", slug).
		Delete(&model.ThemeInstance{}).Error
}

// UpdateMetadata 从磁盘同步主题元数据（schema + version + author 等）
func (r *ThemeRepository) UpdateMetadata(ctx context.Context, slug string, updates map[string]interface{}) error {
	return r.db.WithContext(ctx).
		Model(&model.ThemeInstance{}).
		Where("slug = ?", slug).
		Updates(updates).Error
}

// ExistsByImageURL 检查主题配置或菜单中是否存在指定图片 URL
func (r *ThemeRepository) ExistsByImageURL(fileURL string) (bool, error) {
	var count int64
	err := r.db.Model(&model.ThemeInstance{}).
		Where("config::text LIKE ? OR menus::text LIKE ?", "%"+fileURL+"%", "%"+fileURL+"%").
		Count(&count).Error
	return count > 0, err
}
