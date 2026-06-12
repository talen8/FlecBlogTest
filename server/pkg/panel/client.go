package panel

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var PanelAPIKey = ""

const baseURL = "https://panel.talen.cyou"

// Version Panel 版本信息
type Version struct {
	ID      int    `json:"id"`
	Version string `json:"version"`
	Date    string `json:"date"`
	Changes string `json:"changes"`
}

// Announcement Panel 公告
type Announcement struct {
	ID      int    `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
	Link    string `json:"link"`
}

// ActivateResponse Panel 激活接口响应
type ActivateResponse struct {
	Success   bool   `json:"success"`
	Days      int    `json:"days"`       // -1=永久, >0=天数
	StartTime string `json:"start_time"` // 激活开始时间
	Error     string `json:"error,omitempty"`
}

// VerifyRecord Panel 校验激活码记录
type VerifyRecord struct {
	Code      string `json:"code"`
	Valid     bool   `json:"valid"`
	Reason    string `json:"reason,omitempty"`
	Days      int    `json:"days"`
	StartTime string `json:"start_time,omitempty"`
}

// ThemeMeta 市场主题元数据
type ThemeMeta struct {
	Slug    string `json:"slug"`
	Version string `json:"version"`
}

// Client Panel API 客户端
type Client struct {
	client *http.Client
	apiKey string
}

// NewClient 创建 Panel 客户端
func NewClient() *Client {
	return &Client{
		client: &http.Client{Timeout: 10 * time.Second},
		apiKey: PanelAPIKey,
	}
}

// FetchVersions 获取所有版本列表
func (c *Client) FetchVersions(ctx context.Context) ([]Version, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"/api/versions", nil)
	if err != nil {
		return nil, err
	}
	c.setAuthHeader(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("请求版本列表失败: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var versions []Version
	if err := json.NewDecoder(resp.Body).Decode(&versions); err != nil {
		return nil, fmt.Errorf("解析版本列表失败: %w", err)
	}

	return versions, nil
}

// ActivateCode 激活码验证
func (c *Client) ActivateCode(ctx context.Context, code, startTime string) (*ActivateResponse, error) {
	body := map[string]string{"code": code, "start_time": startTime}
	var result ActivateResponse
	if err := c.doPost(ctx, "/api/premium/activate", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// VerifyCodes 批量校验激活码
func (c *Client) VerifyCodes(ctx context.Context, codes []string) ([]VerifyRecord, error) {
	body := map[string][]string{"codes": codes}
	var result struct {
		Records []VerifyRecord `json:"records"`
	}
	if err := c.doPost(ctx, "/api/premium/verify", body, &result); err != nil {
		return nil, err
	}
	return result.Records, nil
}

// FetchAnnouncements 获取公告列表
func (c *Client) FetchAnnouncements(ctx context.Context) ([]Announcement, error) {
	var result []Announcement
	if err := c.doGet(ctx, "/api/announcements", &result); err != nil {
		return nil, err
	}
	return result, nil
}

// FetchThemeList 获取市场主题列表（仅 slug + version）
func (c *Client) FetchThemeList(ctx context.Context) ([]ThemeMeta, error) {
	var themes []ThemeMeta
	if err := c.doGet(ctx, "/api/themes", &themes); err != nil {
		return nil, err
	}
	return themes, nil
}

// DoRawGet 发起 GET 请求并返回原始响应，调用方需关闭 resp.Body
func (c *Client) DoRawGet(ctx context.Context, path string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	c.setAuthHeader(req)
	return c.client.Do(req)
}

func (c *Client) setAuthHeader(req *http.Request) {
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}
}

// doGet 通用 Panel API GET 请求
func (c *Client) doGet(ctx context.Context, path string, result any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+path, nil)
	if err != nil {
		return err
	}
	c.setAuthHeader(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("panel API 返回 %d: %s", resp.StatusCode, string(respBody))
	}

	return json.Unmarshal(respBody, result)
}

// doPost 通用 Panel API POST 请求
func (c *Client) doPost(ctx context.Context, path string, body any, result any) error {
	jsonBody, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+path, bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuthHeader(req)

	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("panel API 返回 %d: %s", resp.StatusCode, string(respBody))
	}

	return json.Unmarshal(respBody, result)
}
