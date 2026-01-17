package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"
)

const (
	Version = "1.0.0"
	Port    = "8080"
)

var (
	wellKnownDir  = ".well-known/node-verify"
	challengeFile string
	challenge     string
)

func main() {
	printBanner()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	challenge = os.Args[1]

	// Validate challenge format (alphanumeric, length 20-128)
	if !isValidChallenge(challenge) {
		log.Fatal("❌ Invalid challenge format. Must be alphanumeric, 20-128 characters.")
	}

	// Create verification file
	if err := createVerificationFile(); err != nil {
		log.Fatalf("❌ Failed to create verification file: %v", err)
	}

	// Setup cleanup on exit
	setupCleanup()

	// Start HTTP server
	srv := createServer()

	fmt.Printf("\n✅ Verification server running on port %s\n", Port)
	fmt.Printf("📡 Verification URL: http://YOUR_NODE_IP:%s/.well-known/node-verify/%s\n", Port, challenge)
	fmt.Printf("\n⏳ Waiting for verification request...\n")
	fmt.Printf("💡 Press Ctrl+C to stop the server\n\n")

	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("❌ Server error: %v", err)
	}
}

func printBanner() {
	fmt.Println("╔════════════════════════════════════════════╗")
	fmt.Println("║   AtlasP2P Node Verification Server       ║")
	fmt.Printf("║   Version: %-31s ║\n", Version)
	fmt.Println("╚════════════════════════════════════════════╝")
	fmt.Println()
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Printf("  %s <challenge-token>\n\n", os.Args[0])
	fmt.Println("Example:")
	fmt.Printf("  %s abc123xyz456def789\n\n", os.Args[0])
	fmt.Println("Description:")
	fmt.Println("  Starts an HTTP server on port 8080 to prove node ownership.")
	fmt.Println("  The server will respond to verification requests with your challenge token.")
	fmt.Println()
}

func isValidChallenge(s string) bool {
	// Must be alphanumeric and between 20-128 characters
	if len(s) < 20 || len(s) > 128 {
		return false
	}
	match, _ := regexp.MatchString("^[a-zA-Z0-9]+$", s)
	return match
}

func createVerificationFile() error {
	// Create .well-known directory
	if err := os.MkdirAll(wellKnownDir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Create challenge file
	challengeFile = filepath.Join(wellKnownDir, challenge)
	content := "node-verify:" + challenge

	if err := os.WriteFile(challengeFile, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	fmt.Printf("✅ Created verification file: %s\n", challengeFile)
	return nil
}

func setupCleanup() {
	// Handle Ctrl+C and termination signals
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		cleanup()
		os.Exit(0)
	}()
}

func cleanup() {
	fmt.Println("\n🧹 Cleaning up...")

	// Remove challenge file
	if challengeFile != "" {
		if err := os.Remove(challengeFile); err != nil {
			log.Printf("⚠️  Failed to remove challenge file: %v", err)
		} else {
			fmt.Printf("✅ Removed %s\n", challengeFile)
		}
	}

	// Remove .well-known directory if empty
	if wellKnownDir != "" {
		entries, err := os.ReadDir(wellKnownDir)
		if err == nil && len(entries) == 0 {
			if err := os.Remove(wellKnownDir); err == nil {
				fmt.Printf("✅ Removed %s\n", wellKnownDir)
			}
		}

		// Try to remove .well-known parent if empty
		wellKnownParent := filepath.Dir(wellKnownDir)
		entries, err = os.ReadDir(wellKnownParent)
		if err == nil && len(entries) == 0 {
			os.Remove(wellKnownParent)
		}
	}

	fmt.Println("👋 Verification server stopped")
}

func createServer() *http.Server {
	mux := http.NewServeMux()

	// Serve the challenge file
	mux.HandleFunc("/.well-known/node-verify/", func(w http.ResponseWriter, r *http.Request) {
		// Security: Only allow GET requests
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Extract token from URL
		token := strings.TrimPrefix(r.URL.Path, "/.well-known/node-verify/")

		// Security: Prevent directory traversal
		if filepath.Clean(token) != token || strings.Contains(token, "/") || strings.Contains(token, "\\") {
			http.Error(w, "Invalid path", http.StatusBadRequest)
			return
		}

		// Verify token matches challenge
		if token != challenge {
			http.NotFound(w, r)
			return
		}

		// Log the request
		timestamp := time.Now().Format("2006-01-02 15:04:05")
		fmt.Printf("[%s] 📡 Verification request from %s\n", timestamp, r.RemoteAddr)

		// Serve the verification content
		content := "node-verify:" + challenge
		w.Header().Set("Content-Type", "text/plain")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(content))

		fmt.Printf("[%s] ✅ Verification response sent\n", timestamp)
	})

	// Health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Root endpoint with instructions
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "AtlasP2P Node Verification Server v%s\n\n", Version)
		fmt.Fprintf(w, "Verification endpoint: /.well-known/node-verify/%s\n", challenge[:10]+"...")
		fmt.Fprintf(w, "Status: Running\n")
	})

	return &http.Server{
		Addr:         ":" + Port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  30 * time.Second,
	}
}
