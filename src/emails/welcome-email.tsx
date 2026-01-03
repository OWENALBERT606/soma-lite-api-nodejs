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

interface WelcomeEmailProps {
  name?: string;
  schoolName?: string;
  loginUrl: string;
}

export default function WelcomeEmail({
  name = "there",
  schoolName,
  loginUrl,
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to Soma-Lite!</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>soma-lite</Text>
            <Text style={tagline}>Smart School Management</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={title}>Welcome, {name}! 🎉</Heading>
            <Text style={text}>
              Your account has been successfully created
              {schoolName ? (
                <>
                  {" "}
                  for <strong style={{ color: "#5B9BD5" }}>{schoolName}</strong>
                </>
              ) : (
                ""
              )}
              .
            </Text>
            <Text style={text}>
              You can now log in to access your dashboard and start using
              Soma-Lite to manage your school efficiently.
            </Text>

            {/* Login Button */}
            <Section style={buttonContainer}>
              <Button style={button} href={loginUrl}>
                Go to Login
              </Button>
            </Section>

            {/* Features */}
            <Section style={featuresSection}>
              <Text style={featuresTitle}>What you can do with Soma-Lite:</Text>
              <Text style={featureItem}>📚 Manage Students & Classes</Text>
              <Text style={featureItem}>👨‍🏫 Track Teachers & Staff</Text>
              <Text style={featureItem}>📊 Generate Reports & Marksheets</Text>
              <Text style={featureItem}>💰 Handle Fees & Payments</Text>
            </Section>

            <Text style={mutedText}>
              If you have any questions, please contact your school
              administrator or our support team.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
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
  background: "linear-gradient(135deg, #5B9BD5 0%, #4A8BC2 100%)",
  padding: "40px",
  textAlign: "center" as const,
};

const logoText = {
  color: "#ffffff",
  fontSize: "32px",
  fontWeight: "bold",
  margin: "0",
  letterSpacing: "-1px",
};

const tagline = {
  color: "rgba(255, 255, 255, 0.9)",
  fontSize: "14px",
  margin: "8px 0 0",
  fontWeight: "500",
};

const content = {
  padding: "40px",
};

const title = {
  color: "#333333",
  fontSize: "24px",
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

const featuresSection = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "20px 24px",
  margin: "24px 0",
};

const featuresTitle = {
  color: "#333333",
  fontSize: "14px",
  fontWeight: "600",
  margin: "0 0 12px",
};

const featureItem = {
  color: "#666666",
  fontSize: "14px",
  margin: "8px 0",
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

const footerText = {
  color: "#999999",
  fontSize: "12px",
  margin: "0",
};