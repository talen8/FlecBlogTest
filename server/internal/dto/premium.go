package dto

// PremiumActivateRequest 会员激活请求
type PremiumActivateRequest struct {
	Code string `json:"code" binding:"required"`
}

// PremiumStatusResponse 会员状态响应
type PremiumStatusResponse struct {
	Active        bool   `json:"active"`
	DaysRemaining int    `json:"days_remaining"` // 0=普通会员, -1=永久, >0=剩余天数
	StartTime     string `json:"start_time,omitempty"`
}
