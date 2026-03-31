import type { Finding, Category } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "./analyzer.interface.js";

// Security Analyzer Checks for security-related issues based on URL

export class SecurityAnalyzer implements Analyzer {
  readonly name = "security";
  readonly description = "Analyzes URL for security concerns";
  readonly categories: Category[] = ["network", "general"];

  /** Commonly blocked or suspicious ports */
  private readonly suspiciousPorts = new Set([
    "21", // FTP
    "22", // SSH
    "23", // Telnet
    "25", // SMTP
    "3389", // RDP
    "8080", // Common dev server
    "8443", // Alt HTTPS
  ]);

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    const url = new URL(context.url);

    // Check 1: Suspicious port
    const portFinding = this.checkPort(url);
    if (portFinding) {
      findings.push(portFinding);
    }

    // Check 2: IP address instead of domain
    const ipFinding = this.checkIpAddress(url);
    if (ipFinding) {
      findings.push(ipFinding);
    }

    // Check 3: Sensitive data in URL
    const sensitiveFinding = this.checkSensitiveData(url);
    if (sensitiveFinding) {
      findings.push(sensitiveFinding);
    }

    // Check 4: Subdomain depth
    const subdomainFinding = this.checkSubdomainDepth(url);
    if (subdomainFinding) {
      findings.push(subdomainFinding);
    }

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkPort(url: URL): Finding | null {
    const port = url.port;

    if (!port) {
      return null;
    }

    if (this.suspiciousPorts.has(port)) {
      return {
        id: "security-suspicious-port",
        title: "URL uses non-standard port",
        description: `The URL uses port ${port}, which is not a standard web port. This may indicate a development server or misconfiguration.`,
        severity: "warning",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "Port",
            data: { value: port },
          },
        ],
        impact:
          "May be blocked by firewalls, indicates non-production environment",
        recommendation:
          "Use standard ports (443 for HTTPS, 80 for HTTP) in production",
      };
    }

    if (port !== "80" && port !== "443") {
      return {
        id: "security-custom-port",
        title: "URL uses custom port",
        description: `The URL uses port ${port}. Custom ports may cause accessibility issues for some users.`,
        severity: "info",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "Port",
            data: { value: port },
          },
        ],
        impact: "Some corporate firewalls may block non-standard ports",
        recommendation:
          "Consider using standard ports for broader accessibility",
      };
    }

    return null;
  }

  // Check if URL uses IP address instead of domain

  private checkIpAddress(url: URL): Finding | null {
    const hostname = url.hostname;

    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

    // IPv6 pattern (simplified)
    const ipv6Pattern = /^\[?[a-fA-F0-9:]+\]?$/;

    if (ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)) {
      return {
        id: "security-ip-address",
        title: "URL uses IP address instead of domain",
        description:
          "The URL uses an IP address directly. This prevents proper SSL certificate validation and looks unprofessional.",
        severity: "warning",
        category: "network",
        evidence: [
          {
            type: "url",
            label: "Hostname",
            data: hostname,
          },
        ],
        impact:
          "Cannot use domain-validated SSL, no DNS-based load balancing, harder to remember",
        recommendation:
          "Use a proper domain name with DNS pointing to your server",
      };
    }

    return null;
  }

  private checkSensitiveData(url: URL): Finding | null {
    const sensitiveParams = [
      "password",
      "pwd",
      "pass",
      "secret",
      "token",
      "api_key",
      "apikey",
      "api-key",
      "auth",
      "authorization",
      "credit_card",
      "cc",
      "ssn",
      "social_security",
    ];

    const foundSensitive: string[] = [];

    for (const param of url.searchParams.keys()) {
      const lowerParam = param.toLowerCase();
      if (sensitiveParams.some((s) => lowerParam.includes(s))) {
        foundSensitive.push(param);
      }
    }

    if (foundSensitive.length > 0) {
      return {
        id: "security-sensitive-params",
        title: "URL may contain sensitive data",
        description: `The URL contains parameters that may hold sensitive data: ${foundSensitive.join(", ")}. Sensitive data in URLs is logged in browser history, server logs, and referrer headers.`,
        severity: "critical",
        category: "general",
        evidence: [
          {
            type: "code-snippet",
            label: "Sensitive Parameters",
            data: foundSensitive.join(", "),
          },
        ],
        impact:
          "Security risk: credentials may leak via logs, history, or referrer headers",
        recommendation:
          "Never pass sensitive data in URL parameters. Use POST body or headers instead.",
        learnMoreUrl:
          "https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url",
      };
    }

    return null;
  }

  private checkSubdomainDepth(url: URL): Finding | null {
    const hostname = url.hostname;
    const parts = hostname.split(".");

    // Remove TLD and main domain, count subdomains
    // e.g., "a.b.c.example.com" has 3 subdomains
    const subdomainCount = Math.max(0, parts.length - 2);

    if (subdomainCount >= 4) {
      return {
        id: "security-deep-subdomain",
        title: "URL has unusually deep subdomain",
        description: `The hostname has ${subdomainCount} subdomain levels. Extremely deep subdomains are often used in phishing attacks.`,
        severity: "warning",
        category: "general",
        evidence: [
          {
            type: "url",
            label: "Hostname",
            data: hostname,
          },
          {
            type: "metric",
            label: "Subdomain Depth",
            data: { value: subdomainCount },
          },
        ],
        impact: "May appear suspicious to users, can indicate phishing attempt",
        recommendation: "Use simpler domain structure for better user trust",
      };
    }

    return null;
  }
}
