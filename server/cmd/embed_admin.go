//go:build embed_admin

package main

import "embed"

//go:embed admin/*
var adminFS embed.FS

//go:embed setup/*
var setupFS embed.FS
