package repository

import (
	"context"

	"flec_blog/internal/model"

	"gorm.io/gorm"
)

// PremiumRepository 会员激活记录仓储
type PremiumRepository struct {
	db *gorm.DB
}

// NewPremiumRepository 创建会员激活记录仓储实例
func NewPremiumRepository(db *gorm.DB) *PremiumRepository {
	return &PremiumRepository{db: db}
}

// GetAll 获取所有激活记录（按时间倒序）
func (r *PremiumRepository) GetAll(ctx context.Context) ([]model.PremiumActivation, error) {
	var activations []model.PremiumActivation
	err := r.db.WithContext(ctx).Order("id DESC").Find(&activations).Error
	return activations, err
}

// Save 保存激活记录
func (r *PremiumRepository) Save(ctx context.Context, activation *model.PremiumActivation) error {
	return r.db.WithContext(ctx).Create(activation).Error
}

// Update 更新激活记录
func (r *PremiumRepository) Update(ctx context.Context, activation *model.PremiumActivation) error {
	return r.db.WithContext(ctx).Save(activation).Error
}

// Delete 删除激活记录
func (r *PremiumRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&model.PremiumActivation{}, id).Error
}
