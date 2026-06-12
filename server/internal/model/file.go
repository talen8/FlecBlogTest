package model

import (
	"time"
)

// File 文件模型
type File struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	FileName     string    `json:"file_name" gorm:"type:varchar(255);not null"`
	OriginalName string    `json:"original_name" gorm:"type:varchar(255);not null"`
	FilePath     string    `json:"file_path" gorm:"type:varchar(500);not null"`
	FileSize     int64     `json:"file_size"`
	FileType     string    `json:"file_type" gorm:"type:varchar(100)"`
	UploadType   string    `json:"upload_type" gorm:"type:varchar(100);index"`
	StorageType  string    `json:"storage_type" gorm:"type:varchar(20);index"`
	UserID       *uint     `json:"user_id" gorm:"index"`
	FileURL      string    `json:"file_url" gorm:"type:varchar(500)"`
	Status       int       `json:"status" gorm:"default:0;index"` // 0:未使用 1:使用中
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
