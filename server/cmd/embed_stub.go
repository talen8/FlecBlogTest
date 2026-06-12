//go:build !embed_admin

package main

import "embed"

// adminFS 为空 — Docker 模式下 Admin 由独立镜像 serve
var adminFS embed.FS

//go:embed setup/*
var setupFS embed.FS
