import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Search, 
  ChevronDown, 
  ChevronUp,
  BookOpen,
  TrendingUp,
  Users,
  Gift,
  Unlock,
  Shield,
  Wallet,
  User,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HelpCenterPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  const faqCategories = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: BookOpen,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      questions: [
        {
          q: 'What is Network Capital?',
          a: 'Network Capital is a community-driven platform where your social engagement and group participation build your Network Score. This score unlocks activity-based incentives and opportunities. We are NOT a bank, investment platform, or credit provider.',
        },
        {
          q: 'How do I create an account?',
          a: 'Tap "Sign Up" on the login screen, enter your username, email, and password, then create your account. You\'ll have immediate access to the Feed, Wallet, and Stokvel+ features.',
        },
        {
          q: 'Is Network Capital free to use?',
          a: 'Creating an account is free. Platform fees apply for specific actions: $10 to create a Stokvel+ group, $2 to join an existing group. These fees support platform operations and are non-refundable.',
        },
        {
          q: 'What can I do on the platform?',
          a: 'You can: Post and engage with the community, build your Network Score, create or join Stokvel+ savings groups, earn activity-based incentives, track your wallet balance, and compete on leaderboards.',
        },
      ],
    },
    {
      id: 'network-score',
      title: 'Network Score',
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      questions: [
        {
          q: 'What is the Network Score?',
          a: 'Your Network Score (0-100) measures your contribution and engagement on the platform. It\'s calculated from: Contribution Consistency (30 pts), Contribution Amount (20 pts), Platform Engagement (15 pts), Referrals (15 pts), and Group Health (20 pts).',
        },
        {
          q: 'How do I increase my score?',
          a: 'Contribute regularly to your Stokvel+ groups, engage with posts and comments, refer friends to join, and help your groups succeed. Consistency matters more than large single contributions.',
        },
        {
          q: 'What are the score tiers?',
          a: 'Basic (41-70): 3% contribution bonus, 1% cashback. Boosted (71-85): 7% bonus, 3% cashback. Premium (86-100): 10% bonus, 5% cashback. Scores below 41 do not qualify for tier benefits.',
        },
        {
          q: 'Can my score decrease?',
          a: 'Yes. Your score reflects recent activity. If you stop contributing or engaging, your consistency score will decrease over time. Stay active to maintain your tier.',
        },
      ],
    },
    {
      id: 'stokvel',
      title: 'Stokvel+',
      icon: Users,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
      questions: [
        {
          q: 'What is a Stokvel+?',
          a: 'Stokvel+ is a community savings group feature. Members pool contributions together toward a shared goal. It\'s inspired by traditional African savings clubs (stokvels) with added gamification and incentives.',
        },
        {
          q: 'How do I create a Stokvel+?',
          a: 'Go to Stokvel+ tab, tap "Create New", set your group name, target amount, and payout cycle. A $10 platform fee is deducted from your wallet. You must have sufficient wallet balance.',
        },
        {
          q: 'How do I join a Stokvel+?',
          a: 'Browse available groups in the Stokvel+ tab and tap "Join" on any group. A $2 joining fee is deducted from your wallet. Some groups may require an invitation.',
        },
        {
          q: 'What happens to my contributions?',
          a: 'Contributions go into the group\'s shared pool. The pool grows as members contribute. Payouts follow the group\'s cycle. Your contributions are tracked and affect your Network Score.',
        },
        {
          q: 'Can I withdraw my contributions anytime?',
          a: 'Standard withdrawals follow the group\'s payout schedule. Smart Access may allow early access for eligible Premium tier members, subject to group rules and available funds.',
        },
      ],
    },
    {
      id: 'rewards',
      title: 'Rewards',
      icon: Gift,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      questions: [
        {
          q: 'What are rewards?',
          a: 'Rewards are activity-based incentives earned through participation. They include contribution bonuses (added to your group pool) and cashback (added to your wallet). Rewards are NOT guaranteed income or investment returns.',
        },
        {
          q: 'How are rewards calculated?',
          a: 'Rewards are a percentage of your contributions based on your tier: Basic (3% bonus, 1% cashback), Boosted (7% bonus, 3% cashback), Premium (10% bonus, 5% cashback).',
        },
        {
          q: 'Are rewards guaranteed?',
          a: 'NO. Rewards are incentives based on your activity and are subject to platform performance and terms. They should not be considered guaranteed income, profits, or investment returns.',
        },
        {
          q: 'Where do I see my rewards?',
          a: 'View your rewards in the Rewards page, accessible from any Stokvel+ group detail page. You\'ll see total rewards, breakdown by type, and history.',
        },
      ],
    },
    {
      id: 'smart-access',
      title: 'Smart Access',
      icon: Unlock,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      questions: [
        {
          q: 'What is Smart Access?',
          a: 'Smart Access allows eligible members to access a portion of their pooled funds before the standard payout cycle. It\'s early access to YOUR contributions, not a loan or credit.',
        },
        {
          q: 'Who qualifies for Smart Access?',
          a: 'Eligibility requires: Premium tier (score 86+), minimum 30 days of consistent contributions, and no recent defaults. Eligibility is checked automatically.',
        },
        {
          q: 'Is Smart Access a loan?',
          a: 'NO. Smart Access is early access to pooled funds you\'ve contributed. There is no interest, no debt, and no credit involved. Network Capital is NOT a credit provider.',
        },
        {
          q: 'How much can I access?',
          a: 'Smart Access limits depend on your contribution history and group rules. Typically up to 50% of your contributed amount, subject to available pool funds.',
        },
      ],
    },
    {
      id: 'safety-trust',
      title: 'Safety & Trust',
      icon: Shield,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      questions: [
        {
          q: 'Is Network Capital a bank?',
          a: 'NO. Network Capital is NOT a bank, financial institution, or registered credit provider. We do not hold banking licenses. Wallet balances are for platform use only.',
        },
        {
          q: 'Is this an investment platform?',
          a: 'NO. Network Capital is NOT an investment platform. We do not offer investment products, securities, or financial instruments. Rewards are activity incentives, not investment returns.',
        },
        {
          q: 'Are there guaranteed returns?',
          a: 'NO. We do not guarantee any returns, profits, or income. All benefits depend on your participation, group performance, and platform terms. Results vary.',
        },
        {
          q: 'What are the risks?',
          a: 'Risks include: Group performance may vary, rewards are not guaranteed, platform terms may change, and wallet balances are subject to platform operations. Only contribute what you can afford.',
        },
        {
          q: 'How is my data protected?',
          a: 'We use encryption for data transmission and secure storage practices. Your password is hashed. We do not share personal data with third parties for marketing.',
        },
      ],
    },
    {
      id: 'wallet',
      title: 'Wallet & Transactions',
      icon: Wallet,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      questions: [
        {
          q: 'How do I add funds to my wallet?',
          a: 'Go to Wallet tab and tap "Deposit". Enter the amount and confirm. Funds will be available immediately for platform use.',
        },
        {
          q: 'What are wallet fees?',
          a: 'Platform fees: $10 to create a Stokvel+, $2 to join a Stokvel+. These are deducted from your wallet balance automatically.',
        },
        {
          q: 'Can I withdraw from my wallet?',
          a: 'Wallet withdrawals follow platform terms. Stokvel+ contributions follow group payout cycles. Contact support for specific withdrawal inquiries.',
        },
        {
          q: 'Is my wallet balance insured?',
          a: 'Wallet balances are NOT insured or guaranteed. Network Capital is not a bank. Only deposit funds you intend to use on the platform.',
        },
      ],
    },
    {
      id: 'account',
      title: 'Account & Profile',
      icon: User,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      questions: [
        {
          q: 'How do I edit my profile?',
          a: 'Go to Profile tab, tap the edit button (pencil icon), update your username, bio, or photo, then tap save.',
        },
        {
          q: 'How do I find my User ID?',
          a: 'Your User ID is displayed on your Profile page. Tap "Copy" to copy it. Share this ID when someone wants to invite you to their Stokvel+.',
        },
        {
          q: 'How do I refer friends?',
          a: 'Tap "Invite Friends" on your Profile page. Share your referral link. You earn +200 points when friends sign up and become active.',
        },
        {
          q: 'How do I logout?',
          a: 'Go to Profile tab and tap "Logout" at the bottom of the page.',
        },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: AlertCircle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      questions: [
        {
          q: 'I can\'t login to my account',
          a: 'Ensure your email and password are correct. Passwords are case-sensitive. If you forgot your password, contact support for assistance.',
        },
        {
          q: 'My contribution didn\'t go through',
          a: 'Check your wallet balance - you need sufficient funds. Verify the Stokvel+ group is still active. Try again or contact support if the issue persists.',
        },
        {
          q: 'My score isn\'t updating',
          a: 'Score updates may take a few moments. Refresh the page. If your score seems incorrect, check your recent activity and contribution history.',
        },
        {
          q: 'I have another issue',
          a: 'For issues not covered here, contact our support team through the app. Provide details about the problem, your username, and any error messages.',
        },
      ],
    },
  ];

  const filteredCategories = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => 
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => searchQuery === '' || category.questions.length > 0);

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
    setExpandedQuestion(null);
  };

  const toggleQuestion = (questionKey) => {
    setExpandedQuestion(expandedQuestion === questionKey ? null : questionKey);
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              data-testid="help-back-button"
            >
              <ArrowLeft className="text-white" size={20} />
            </button>
            <div>
              <h1 className="text-xl font-heading font-bold text-white">Help Center</h1>
              <p className="text-xs text-white/70">Find answers to your questions</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for help..."
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-0 focus:ring-2 focus:ring-secondary outline-none"
              data-testid="help-search-input"
            />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {/* Important Notice */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/20 rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <HelpCircle className="text-primary flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">Important Information</p>
              <p className="text-xs text-text-secondary">
                Network Capital is a community platform, not a bank or investment service. 
                All rewards are activity-based incentives, not guaranteed income.
              </p>
            </div>
          </div>
        </motion.div>

        {/* FAQ Categories */}
        {filteredCategories.map((category, idx) => {
          const Icon = category.icon;
          const isExpanded = expandedCategory === category.id;

          return (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                data-testid={`category-${category.id}`}
              >
                <div className={`w-10 h-10 ${category.bgColor} rounded-xl flex items-center justify-center`}>
                  <Icon className={category.color} size={20} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-text-primary">{category.title}</p>
                  <p className="text-xs text-text-muted">{category.questions.length} questions</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="text-text-muted" size={20} />
                ) : (
                  <ChevronDown className="text-text-muted" size={20} />
                )}
              </button>

              {/* Questions */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-100"
                  >
                    {category.questions.map((item, qIdx) => {
                      const questionKey = `${category.id}-${qIdx}`;
                      const isQExpanded = expandedQuestion === questionKey;

                      return (
                        <div key={qIdx} className="border-b border-gray-50 last:border-0">
                          <button
                            onClick={() => toggleQuestion(questionKey)}
                            className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                            data-testid={`question-${questionKey}`}
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-text-primary">{item.q}</p>
                            </div>
                            {isQExpanded ? (
                              <ChevronUp className="text-text-muted flex-shrink-0 mt-0.5" size={16} />
                            ) : (
                              <ChevronDown className="text-text-muted flex-shrink-0 mt-0.5" size={16} />
                            )}
                          </button>
                          
                          <AnimatePresence>
                            {isQExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="px-4 pb-4"
                              >
                                <p className="text-sm text-text-secondary leading-relaxed bg-background-subtle rounded-xl p-3">
                                  {item.a}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* No Results */}
        {searchQuery && filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Search className="mx-auto mb-4 text-text-muted" size={48} />
            <p className="text-text-secondary mb-2">No results found</p>
            <p className="text-sm text-text-muted">Try a different search term</p>
          </div>
        )}

        {/* Contact Support */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-primary to-secondary rounded-2xl p-6 text-center mt-6"
        >
          <HelpCircle className="mx-auto mb-3 text-white" size={32} />
          <h3 className="text-lg font-heading font-bold text-white mb-2">Still need help?</h3>
          <p className="text-white/80 text-sm mb-4">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <button 
            className="bg-white text-primary font-medium px-6 py-2 rounded-full hover:bg-white/90 transition-all"
            data-testid="contact-support-button"
          >
            Contact Support
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default HelpCenterPage;
