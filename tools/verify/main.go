package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Build-time configuration (injected via ldflags from build.sh)
// These placeholders are overridden at compile time - do not use defaults
var (
	Version     = "2.0.0"
	ApiUrl      = ""  // Injected: -X main.ApiUrl=$API_URL
	DaemonNames = ""  // Injected: -X main.DaemonNames=$DAEMON_NAMES
	DefaultPort = ""  // Injected: -X main.DefaultPort=$DEFAULT_PORT
	ChainName   = ""  // Injected: -X main.ChainName=$CHAIN_NAME
)

// API Request/Response structures
type InitRequest struct {
	Challenge string `json:"challenge"`
	Hostname  string `json:"hostname,omitempty"`
}

type InitResponse struct {
	Success bool   `json:"success"`
	Node    struct {
		IP   string `json:"ip"`
		Port int    `json:"port"`
	} `json:"node"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

type ConfirmRequest struct {
	Challenge string `json:"challenge"`
	ProcessCheck struct {
		Found      bool   `json:"found"`
		Method     string `json:"method"`
		DaemonName string `json:"daemonName,omitempty"`
	} `json:"processCheck"`
	PortCheck struct {
		Listening bool   `json:"listening"`
		Port      int    `json:"port"`
		Method    string `json:"method"`
	} `json:"portCheck"`
	SystemInfo struct {
		Hostname string `json:"hostname,omitempty"`
		Platform string `json:"platform,omitempty"`
		Arch     string `json:"arch,omitempty"`
	} `json:"systemInfo,omitempty"`
}

type ConfirmResponse struct {
	Success bool   `json:"success"`
	Status  string `json:"status,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

func main() {
	// Validate build-time configuration
	if ApiUrl == "" || DaemonNames == "" || DefaultPort == "" || ChainName == "" {
		fmt.Println("ERROR: This binary was not built correctly.")
		fmt.Println("Build-time configuration is missing. Use build.sh to compile.")
		os.Exit(1)
	}

	printBanner()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	challenge := os.Args[1]

	// Validate challenge format
	if !isValidChallenge(challenge) {
		log.Fatal("❌ Invalid challenge format. Must be alphanumeric, 20-128 characters.")
	}

	fmt.Println("Starting node verification process...")
	fmt.Println()

	// Step 1: Initialize verification and get node details
	fmt.Println("Step 1/3: Fetching node details from API...")
	nodeIP, nodePort, err := initVerification(challenge)
	if err != nil {
		log.Fatalf("❌ Failed to initialize verification: %v", err)
	}
	fmt.Printf("  ✅ Node IP: %s\n", nodeIP)
	fmt.Printf("  ✅ Node Port: %d\n", nodePort)
	fmt.Println()

	// Step 2: Check local node process and port
	fmt.Println("Step 2/3: Checking local node process and port...")

	// Check process
	processFound, processMethod, daemonName := checkProcess()
	if processFound {
		fmt.Printf("  ✅ Found daemon: %s (method: %s)\n", daemonName, processMethod)
	} else {
		fmt.Printf("  ❌ No node daemon found. Expected: %s\n", DaemonNames)
	}

	// Check port
	port, _ := strconv.Atoi(DefaultPort)
	portListening, portMethod := checkPort(port)
	if portListening {
		fmt.Printf("  ✅ Port %d is listening (method: %s)\n", port, portMethod)
	} else {
		fmt.Printf("  ❌ Port %d is not listening\n", port)
	}
	fmt.Println()

	// Step 3: Submit verification results
	fmt.Println("Step 3/3: Submitting verification to API...")
	if err := confirmVerification(challenge, processFound, processMethod, daemonName, portListening, portMethod, port); err != nil {
		log.Fatalf("❌ Failed to submit verification: %v", err)
	}

	fmt.Println()
	fmt.Println("✅ Verification submitted successfully!")
	fmt.Println("   Your verification will be reviewed by an admin.")
	fmt.Println()
}

func printBanner() {
	fmt.Println("╔════════════════════════════════════════════╗")
	fmt.Printf("║   %s Node Verification Tool", padRight(ChainName, 23))
	fmt.Println("        ║")
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
	fmt.Printf("  Verifies %s node ownership by checking:\n", ChainName)
	fmt.Printf("  - Node daemon process is running (%s)\n", DaemonNames)
	fmt.Printf("  - Node port is listening (port %s)\n", DefaultPort)
	fmt.Println("  - Request originates from node's IP address")
	fmt.Println()
	fmt.Println("IMPORTANT: Run this command on your node server,")
	fmt.Println("           not on your local computer!")
	fmt.Println()
}

func padRight(s string, length int) string {
	if len(s) >= length {
		return s
	}
	return s + strings.Repeat(" ", length-len(s))
}

func isValidChallenge(s string) bool {
	if len(s) < 20 || len(s) > 128 {
		return false
	}
	match, _ := regexp.MatchString("^[a-zA-Z0-9]+$", s)
	return match
}

func initVerification(challenge string) (string, int, error) {
	// Get hostname
	hostname, _ := os.Hostname()

	// Prepare request
	reqBody := InitRequest{
		Challenge: challenge,
		Hostname:  hostname,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", 0, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make API request
	url := ApiUrl + "/api/verify-node/init"
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", 0, fmt.Errorf("failed to connect to API: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var initResp InitResponse
	if err := json.Unmarshal(body, &initResp); err != nil {
		return "", 0, fmt.Errorf("failed to parse response: %w", err)
	}

	if !initResp.Success {
		return "", 0, fmt.Errorf("API error: %s", initResp.Error)
	}

	return initResp.Node.IP, initResp.Node.Port, nil
}

func checkProcess() (bool, string, string) {
	daemons := strings.Split(DaemonNames, ",")

	for _, daemon := range daemons {
		daemon = strings.TrimSpace(daemon)

		// Try ps command (most compatible)
		if found, method := checkProcessPS(daemon); found {
			return true, method, daemon
		}

		// Try pidof (Linux)
		if found, method := checkProcessPidof(daemon); found {
			return true, method, daemon
		}

		// Try pgrep (Unix-like)
		if found, method := checkProcessPgrep(daemon); found {
			return true, method, daemon
		}
	}

	return false, "", ""
}

func checkProcessPS(daemon string) (bool, string) {
	cmd := exec.Command("ps", "aux")
	output, err := cmd.Output()
	if err != nil {
		return false, ""
	}

	// Check if daemon name appears in ps output
	if strings.Contains(string(output), daemon) {
		return true, "ps"
	}

	return false, ""
}

func checkProcessPidof(daemon string) (bool, string) {
	cmd := exec.Command("pidof", daemon)
	err := cmd.Run()
	if err == nil {
		return true, "pidof"
	}
	return false, ""
}

func checkProcessPgrep(daemon string) (bool, string) {
	cmd := exec.Command("pgrep", "-x", daemon)
	err := cmd.Run()
	if err == nil {
		return true, "pgrep"
	}
	return false, ""
}

func checkPort(port int) (bool, string) {
	// Try netstat (most compatible)
	if listening, method := checkPortNetstat(port); listening {
		return true, method
	}

	// Try ss (modern Linux)
	if listening, method := checkPortSS(port); listening {
		return true, method
	}

	// Try lsof (macOS/BSD)
	if listening, method := checkPortLsof(port); listening {
		return true, method
	}

	return false, ""
}

func checkPortNetstat(port int) (bool, string) {
	cmd := exec.Command("netstat", "-an")
	output, err := cmd.Output()
	if err != nil {
		return false, ""
	}

	// Look for port in LISTEN state
	portStr := fmt.Sprintf(":%d", port)
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, portStr) && strings.Contains(line, "LISTEN") {
			return true, "netstat"
		}
	}

	return false, ""
}

func checkPortSS(port int) (bool, string) {
	cmd := exec.Command("ss", "-lntp")
	output, err := cmd.Output()
	if err != nil {
		return false, ""
	}

	// Look for port in LISTEN state
	portStr := fmt.Sprintf(":%d", port)
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, portStr) && strings.Contains(line, "LISTEN") {
			return true, "ss"
		}
	}

	return false, ""
}

func checkPortLsof(port int) (bool, string) {
	cmd := exec.Command("lsof", "-i", fmt.Sprintf(":%d", port))
	err := cmd.Run()
	if err == nil {
		return true, "lsof"
	}
	return false, ""
}

func confirmVerification(challenge string, processFound bool, processMethod string, daemonName string, portListening bool, portMethod string, port int) error {
	// Get system info
	hostname, _ := os.Hostname()

	// Prepare request
	reqBody := ConfirmRequest{
		Challenge: challenge,
	}

	reqBody.ProcessCheck.Found = processFound
	reqBody.ProcessCheck.Method = processMethod
	reqBody.ProcessCheck.DaemonName = daemonName

	reqBody.PortCheck.Listening = portListening
	reqBody.PortCheck.Port = port
	reqBody.PortCheck.Method = portMethod

	reqBody.SystemInfo.Hostname = hostname
	reqBody.SystemInfo.Platform = runtime.GOOS
	reqBody.SystemInfo.Arch = runtime.GOARCH

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make API request
	url := ApiUrl + "/api/verify-node/confirm"
	client := &http.Client{Timeout: 10 * time.Second}

	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to connect to API: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var confirmResp ConfirmResponse
	if err := json.Unmarshal(body, &confirmResp); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}

	if !confirmResp.Success {
		return fmt.Errorf("API error: %s", confirmResp.Error)
	}

	return nil
}
