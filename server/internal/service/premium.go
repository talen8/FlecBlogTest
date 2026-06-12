package service

import (
	"context"
	"fmt"
	"time"

	"flec_blog/internal/dto"
	"flec_blog/internal/model"
	"flec_blog/internal/repository"
	"flec_blog/pkg/logger"
	"flec_blog/pkg/panel"
)

type PremiumService struct {
	repo  *repository.PremiumRepository
	panel *panel.Client
}

// NewPremiumService 创建会员服务实例
func NewPremiumService(repo *repository.PremiumRepository, panelClient *panel.Client) *PremiumService {
	return &PremiumService{repo: repo, panel: panelClient}
}

// GetStatus 获取当前站点会员状态
func (s *PremiumService) GetStatus(ctx context.Context) (*dto.PremiumStatusResponse, error) {
	activations, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	return s.calcStatus(activations), nil
}

// IsPremiumActive 判断当前站点会员是否有效
func (s *PremiumService) IsPremiumActive() bool {
	activations, _ := s.repo.GetAll(context.Background())
	return s.calcStatus(activations).Active
}

// Activate 激活会员
func (s *PremiumService) Activate(ctx context.Context, code string) (*dto.PremiumStatusResponse, error) {
	// 查询当前状态，确定累加基准时间
	activations, err := s.repo.GetAll(ctx)
	if err != nil {
		return nil, err
	}
	current := s.calcStatus(activations)

	baseTime := time.Now()
	if current.Active && current.DaysRemaining > 0 {
		if latest := findLatestActive(activations); latest != nil {
			baseTime = expiresAt(latest)
		}
	}

	// 调 Panel 验证激活码
	panelResp, err := s.panel.ActivateCode(ctx, code, baseTime.Format(time.RFC3339))
	if err != nil {
		return nil, fmt.Errorf("验证激活码失败: %w", err)
	}
	if !panelResp.Success {
		return nil, fmt.Errorf("激活失败: %s", panelResp.Error)
	}

	// 解析 Panel 返回的激活开始时间
	startTime, _ := time.Parse(time.RFC3339, panelResp.StartTime)
	if startTime.IsZero() {
		startTime = time.Now()
	}

	// 保存激活记录
	activation := &model.PremiumActivation{
		Code:      code,
		Days:      panelResp.Days,
		StartTime: startTime,
	}

	if err := s.repo.Save(ctx, activation); err != nil {
		return nil, err
	}

	logger.Info("会员激活成功: code=%s, days=%d", code, panelResp.Days)

	activations, _ = s.repo.GetAll(ctx)
	return s.calcStatus(activations), nil
}

// Calibrate 与 Panel 校准激活记录
func (s *PremiumService) Calibrate(ctx context.Context) error {
	activations, err := s.repo.GetAll(ctx)
	if err != nil || len(activations) == 0 {
		return err
	}

	// 提取所有激活码
	codes := make([]string, len(activations))
	for i, a := range activations {
		codes[i] = a.Code
	}

	// 调 Panel 校验
	panelRecords, err := s.panel.VerifyCodes(ctx, codes)
	if err != nil {
		logger.Warn("Panel 校验失败: %v", err)
		return nil
	}

	panelMap := make(map[string]panel.VerifyRecord, len(panelRecords))
	for _, r := range panelRecords {
		panelMap[r.Code] = r
	}

	needUpdate := false
	for i := range activations {
		a := &activations[i]
		p, exists := panelMap[a.Code]

		// Panel 不存在或未使用 → 伪造记录，删除
		if !exists || !p.Valid {
			logger.Warn("伪造激活记录，删除: code=%s", a.Code)
			if err := s.repo.Delete(ctx, a.ID); err != nil {
				logger.Warn("删除失败: code=%s, err=%v", a.Code, err)
			}
			needUpdate = true
			continue
		}

		// 检查 days
		if a.Days != p.Days {
			logger.Warn("days 不一致，修正: code=%s", a.Code)
			a.Days = p.Days
			needUpdate = true
		}

		// 检查激活开始时间
		if p.StartTime != "" {
			panelStart, _ := time.Parse(time.RFC3339, p.StartTime)
			if !panelStart.IsZero() && a.StartTime.Format("2006-01-02") != panelStart.Format("2006-01-02") {
				logger.Warn("激活时间不一致，修正: code=%s", a.Code)
				a.StartTime = panelStart
				needUpdate = true
			}
		}
	}

	if needUpdate {
		for i := range activations {
			if err := s.repo.Update(ctx, &activations[i]); err != nil {
				logger.Warn("校准更新失败: code=%s, err=%v", activations[i].Code, err)
			}
		}
		logger.Info("会员数据校准完成")
	}

	return nil
}

// calcStatus 计算会员状态
func (s *PremiumService) calcStatus(activations []model.PremiumActivation) *dto.PremiumStatusResponse {
	if len(activations) == 0 {
		return &dto.PremiumStatusResponse{Active: false, DaysRemaining: 0}
	}

	latest := findLatestActive(activations)
	if latest == nil {
		return &dto.PremiumStatusResponse{Active: false, DaysRemaining: 0}
	}

	resp := &dto.PremiumStatusResponse{
		Active:    true,
		StartTime: latest.StartTime.Format("2006-01-02 15:04:05"),
	}

	if latest.Days == -1 {
		resp.DaysRemaining = -1
	} else {
		remaining := int(time.Until(expiresAt(latest)).Hours() / 24)
		resp.DaysRemaining = max(remaining, 0)
	}

	return resp
}

// findLatestActive 查找最新的有效激活记录
func findLatestActive(activations []model.PremiumActivation) *model.PremiumActivation {
	var latest *model.PremiumActivation
	for i := range activations {
		a := &activations[i]
		if a.Days == -1 {
			return &activations[i] // 永久会员优先
		}
		if time.Now().Before(expiresAt(a)) {
			if latest == nil || expiresAt(a).After(expiresAt(latest)) {
				latest = &activations[i]
			}
		}
	}
	return latest
}

// expiresAt 计算激活记录的到期时间
func expiresAt(a *model.PremiumActivation) time.Time {
	if a.Days == -1 {
		return time.Time{} // 永久会员返回零值
	}
	return a.StartTime.AddDate(0, 0, a.Days)
}
