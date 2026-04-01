import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const LegalDocumentsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'terms';
  const [activeTab, setActiveTab] = useState(initialTab);

  const termsContent = {
    title: "Terms & Conditions",
    operator: "Operated by: Mici (Pty) Ltd, South Africa",
    effectiveDate: "Effective Date: January 2025",
    sections: [
      {
        title: "1. Introduction",
        content: `Welcome to Network Capital, operated by Mici (Pty) Ltd ("we", "our", "the Platform").

By using our Platform, you agree to these Terms & Conditions. If you do not agree, do not use the Platform.`
      },
      {
        title: "2. Services Provided",
        content: `Network Capital allows users to:
• Join group savings (stokvels)
• Contribute to pooled funds
• Earn rewards based on participation and network performance
• Access Smart Rewards and early allocations

Important: Network Capital does NOT provide loans or financial advice.

Funds are held with regulated financial partners in South Africa and internationally.`
      },
      {
        title: "3. Eligibility",
        content: `• Users must be 18 years or older, or the legal age in their jurisdiction.
• Users must provide accurate identification for KYC/AML compliance.`
      },
      {
        title: "4. User Accounts",
        content: `• Users are responsible for safeguarding their credentials.
• All activity through your account is your responsibility.
• Unauthorized activity must be reported immediately.`
      },
      {
        title: "5. Contributions & Wallets",
        content: `• Contributions are voluntary and tracked in digital wallets.
• Group pools are managed according to multi-signature approval rules.
• Early access to funds is conditional on:
  - Network Score
  - Group performance
  - Pool liquidity`
      },
      {
        title: "6. Rewards",
        content: `• Rewards are based on participation, consistency, and network strength.
• Rewards are not interest or financial returns.
• Rewards may be adjusted due to compliance, fraud prevention, or system errors.`
      },
      {
        title: "7. Payment Processing",
        content: `• Payments are processed via third-party providers (e.g., Flutterwave, DusuPay).
• Mici (Pty) Ltd is not liable for delays or errors caused by banks or processors.
• All funds are held in regulated accounts.`
      },
      {
        title: "8. Compliance",
        content: `Users must comply with:
• South African laws (FIC Act, POPIA)
• Anti-Money Laundering (AML)
• Counter-Terrorism Financing (CTF)
• Relevant local and international financial regulations

Accounts may be suspended for suspicious or illegal activity.`
      },
      {
        title: "9. Data & Privacy",
        content: `• User data is collected and processed according to our Privacy Policy.
• By using the Platform, you consent to the collection, storage, and processing of your data.`
      },
      {
        title: "10. Disclaimers",
        content: `• The Platform is provided "as-is".
• Network Capital does not guarantee profits, returns, or rewards.
• Users assume all risks when participating in group savings.`
      },
      {
        title: "11. Limitation of Liability",
        content: `Mici (Pty) Ltd is not liable for:
• Losses from technical failures
• Unauthorized access to accounts
• Delays in payments by financial institutions`
      },
      {
        title: "12. Termination",
        content: `• Mici (Pty) Ltd may suspend or terminate accounts at its discretion.
• Users may close accounts after withdrawing funds.`
      },
      {
        title: "13. Governing Law",
        content: `• Terms are governed by South African law.
• Disputes will be resolved through South African courts or arbitration agreements.`
      },
      {
        title: "14. Changes to Terms",
        content: `• Mici (Pty) Ltd may update Terms periodically.
• Users will be notified via email or in-app notification.`
      }
    ]
  };

  const privacyContent = {
    title: "Privacy Policy",
    operator: "Operated by: Mici (Pty) Ltd, South Africa",
    effectiveDate: "Effective Date: January 2025",
    sections: [
      {
        title: "1. Introduction",
        content: `Mici (Pty) Ltd values your privacy. This policy explains how we collect, use, and protect personal data globally.`
      },
      {
        title: "2. Data We Collect",
        content: `• Personal info: Name, email, phone, date of birth, ID documents (for KYC/AML)
• Financial info: Bank accounts, wallet balances, transaction history
• Usage data: Device info, app usage, engagement with groups & rewards`
      },
      {
        title: "3. How We Use Data",
        content: `• Provide Platform services
• Verify identity (KYC/AML compliance)
• Detect and prevent fraud or illegal activity
• Improve app functionality & user experience
• Communicate updates, notifications, marketing (with consent)`
      },
      {
        title: "4. Data Sharing",
        content: `Shared only with:
• Financial partners (banks, payment processors)
• Regulatory authorities as required
• Service providers for operations

No sale of personal data to third parties.`
      },
      {
        title: "5. International Transfers",
        content: `Data may be transferred across borders.

Transfers comply with:
• GDPR (for EU users)
• POPIA (South Africa)
• Other applicable laws`
      },
      {
        title: "6. Data Retention",
        content: `Retained only as needed for:
• Legal compliance
• Operational needs
• Fraud prevention

Users may request deletion, subject to legal obligations.`
      },
      {
        title: "7. User Rights",
        content: `• Access, correct, or request deletion of personal data
• Opt-out of marketing
• Export data in a machine-readable format`
      },
      {
        title: "8. Security",
        content: `Data is protected via:
• Encryption in transit & at rest
• Access controls
• Regular audits`
      },
      {
        title: "9. Children",
        content: `• Platform is not for users under 18
• No knowingly collected data from minors`
      },
      {
        title: "10. Changes to Policy",
        content: `Updates communicated via email or in-app notification.`
      },
      {
        title: "11. Contact",
        content: `Privacy inquiries: privacy@networkcapital.com`
      }
    ]
  };

  const currentContent = activeTab === 'terms' ? termsContent : privacyContent;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              data-testid="legal-back-button"
            >
              <ArrowLeft className="text-white" size={20} />
            </button>
            <div>
              <h1 className="text-xl font-heading font-bold text-white">Legal Documents</h1>
              <p className="text-xs text-white/70">Mici (Pty) Ltd, South Africa</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/20">
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'terms'
                ? 'bg-white text-primary'
                : 'text-white/80 hover:bg-white/10'
            }`}
            data-testid="terms-tab"
          >
            <FileText size={16} />
            Terms & Conditions
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'privacy'
                ? 'bg-white text-primary'
                : 'text-white/80 hover:bg-white/10'
            }`}
            data-testid="privacy-tab"
          >
            <Shield size={16} />
            Privacy Policy
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Document Header */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4"
        >
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
            {currentContent.title}
          </h2>
          <p className="text-sm text-text-secondary">{currentContent.operator}</p>
          <p className="text-sm text-text-muted">{currentContent.effectiveDate}</p>
        </motion.div>

        {/* Document Sections */}
        <div className="space-y-3">
          {currentContent.sections.map((section, idx) => (
            <DocumentSection key={idx} section={section} index={idx} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/20 text-center">
          <p className="text-sm text-text-secondary">
            By using Network Capital, you agree to these {activeTab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}.
          </p>
          <p className="text-xs text-text-muted mt-2">
            © 2025 Mici (Pty) Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

const DocumentSection = ({ section, index }) => {
  const [expanded, setExpanded] = useState(index < 3); // First 3 sections expanded by default

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
        data-testid={`section-${index}`}
      >
        <h3 className="font-semibold text-text-primary">{section.title}</h3>
        {expanded ? (
          <ChevronUp className="text-text-muted flex-shrink-0" size={20} />
        ) : (
          <ChevronDown className="text-text-muted flex-shrink-0" size={20} />
        )}
      </button>
      
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pb-4"
        >
          <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line bg-background-subtle rounded-lg p-4">
            {section.content}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default LegalDocumentsPage;
