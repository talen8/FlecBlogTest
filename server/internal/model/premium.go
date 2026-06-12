package model

import "time"

// PremiumActivation 会员激活记录
type PremiumActivation struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Code      string    `gorm:"type:text;not null" json:"code"`
	Days      int       `gorm:"not null" json:"days"` // -1=永久, >0=天数
	StartTime time.Time `gorm:"not null" json:"start_time"`
	CreatedAt time.Time `json:"created_at"`
}
