import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface AccountApprovedEmailProps {
  name?: string;
  loginUrl: string;
}

export default function AccountApprovedEmail({
  name = "there",
  loginUrl,
}: AccountApprovedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Soma-Lite account has been approved!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header - Green for success */}
          <Section style={header}>
            <Text style={checkmark}>✓</Text>
            <Text style={headerTitle}>Account Approved!</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={title}>Great news, {name}!</Heading>
            <Text style={text}>
              Your Soma-Lite account has been approved by the administrator. You now have
              full access to the Smart School Management system.
            </Text>

            {/* Login Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={loginUrl}>
                Login Now
              </Button>
            </Section>

            <Text style={mutedText}>
              If you have any questions or need assistance, please contact your
              school administrator.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={logoText}>soma-lite</Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} Soma-Lite. Smart School Management.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ==================== STYLES ====================

const main = {
  backgroundColor: "#f5f5f5",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  borderRadius: "12px",
  overflow: "hidden" as const,
  maxWidth: "600px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
};

const header = {
  background: "linear-gradient(135deg, #4CAF50 0%, #43A047 100%)",
  padding: "40px",
  textAlign: "center" as const,
};

const checkmark = {
  color: "#ffffff",
  fontSize: "48px",
  margin: "0 0 8px",
};

const headerTitle = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0",
};

const content = {
  padding: "40px",
};

const title = {
  color: "#333333",
  fontSize: "22px",
  fontWeight: "600",
  margin: "0 0 24px",
};

const text = {
  color: "#555555",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#4CAF50",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 48px",
};

const mutedText = {
  color: "#888888",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "24px 0 0",
};

const footer = {
  backgroundColor: "#f9f9f9",
  padding: "24px 40px",
  textAlign: "center" as const,
  borderTop: "1px solid #eee",
};

const logoText = {
  color: "#5B9BD5",
  fontSize: "18px",
  fontWeight: "bold",
  margin: "0 0 8px",
};

const footerText = {
  color: "#999999",
  fontSize: "12px",
  margin: "0",
};