import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Lightbulb, 
  DollarSign, 
  Clock, 
  Users, 
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Target,
  Calendar
} from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CreateProductPage = ({ user }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    problem_solved: '',
    description: '',
    estimated_cost: '',
    timeline: '',
    interest_level: '',
    category: 'general',
    release_date: '',
    min_support: '10',
    max_support: '1000',
    images: []
  });

  const steps = [
    { id: 1, title: 'Product Info', icon: Package },
    { id: 2, title: 'Problem & Solution', icon: Lightbulb },
    { id: 3, title: 'Costs & Timeline', icon: Clock },
    { id: 4, title: 'Support Settings', icon: Users },
    { id: 5, title: 'Review & Submit', icon: Check }
  ];

  const categories = [
    { value: 'technology', label: 'Technology' },
    { value: 'fashion', label: 'Fashion & Apparel' },
    { value: 'food', label: 'Food & Beverage' },
    { value: 'health', label: 'Health & Wellness' },
    { value: 'education', label: 'Education' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'home', label: 'Home & Living' },
    { value: 'general', label: 'Other' }
  ];

  const interestLevels = [
    { value: 'idea', label: 'Just an idea', desc: 'Concept stage, gathering interest' },
    { value: 'prototype', label: 'Prototype ready', desc: 'Working prototype or samples' },
    { value: 'ready_to_launch', label: 'Ready to launch', desc: 'Product ready, need community support' }
  ];

  const timelines = [
    { value: '1_month', label: '1 Month' },
    { value: '3_months', label: '3 Months' },
    { value: '6_months', label: '6 Months' },
    { value: '12_months', label: '12 Months' },
    { value: 'ongoing', label: 'Ongoing' }
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        estimated_cost: parseFloat(formData.estimated_cost) || 0,
        min_support: parseFloat(formData.min_support) || 10,
        max_support: parseFloat(formData.max_support) || 1000
      };
      
      const res = await axiosInstance.post('/products', payload);
      toast.success('Product submitted for review!');
      navigate(`/products/${res.data.product.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.name && formData.category;
      case 2:
        return formData.problem_solved;
      case 3:
        return formData.estimated_cost && formData.timeline && formData.interest_level;
      case 4:
        return formData.min_support && formData.max_support;
      default:
        return true;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="What's your product called?"
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                data-testid="product-name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Category *</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.category === cat.value
                        ? 'bg-secondary/20 border-secondary text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Short Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Briefly describe your product..."
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none resize-none"
              />
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                What problem does your product solve? *
              </label>
              <textarea
                name="problem_solved"
                value={formData.problem_solved}
                onChange={handleChange}
                rows={4}
                placeholder="Explain the problem your product addresses and how it helps people..."
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none resize-none"
                data-testid="problem-solved"
              />
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-secondary text-sm font-medium mb-2">Tips for a great description:</p>
              <ul className="text-white/60 text-sm space-y-1">
                <li>• Be specific about who benefits</li>
                <li>• Explain the current pain point</li>
                <li>• Describe your unique solution</li>
              </ul>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Estimated Production Cost ($) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input
                  type="number"
                  name="estimated_cost"
                  value={formData.estimated_cost}
                  onChange={handleChange}
                  placeholder="5000"
                  className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                  data-testid="estimated-cost"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Timeline *</label>
              <div className="grid grid-cols-3 gap-2">
                {timelines.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, timeline: t.value })}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      formData.timeline === t.value
                        ? 'bg-secondary/20 border-secondary text-white'
                        : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Current Stage *</label>
              <div className="space-y-2">
                {interestLevels.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, interest_level: level.value })}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      formData.interest_level === level.value
                        ? 'bg-secondary/20 border-secondary'
                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-white font-medium">{level.label}</p>
                    <p className="text-white/60 text-sm">{level.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Expected Release Date</label>
              <input
                type="date"
                name="release_date"
                value={formData.release_date}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white focus:border-secondary outline-none"
              />
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-5">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-secondary text-sm font-medium mb-2">Support Settings</p>
              <p className="text-white/60 text-sm">
                Set the minimum and maximum amounts supporters can contribute. This helps you manage expectations 
                and participation levels.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Minimum Support ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    type="number"
                    name="min_support"
                    value={formData.min_support}
                    onChange={handleChange}
                    placeholder="10"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Maximum Support ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input
                    type="number"
                    name="max_support"
                    value={formData.max_support}
                    onChange={handleChange}
                    placeholder="1000"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 rounded-xl border border-white/20 text-white placeholder-white/40 focus:border-secondary outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="bg-secondary/10 rounded-xl p-4 border border-secondary/30">
              <p className="text-white text-sm">
                <strong className="text-secondary">Note:</strong> Support contributions are tracked transparently. 
                This is community backing, not an investment. No returns or profit-sharing is offered.
              </p>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-5">
            <div className="bg-white/5 rounded-xl p-5 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">{formData.name || 'Your Product'}</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Category</span>
                  <span className="text-white capitalize">{formData.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Estimated Cost</span>
                  <span className="text-white">${formData.estimated_cost || '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Timeline</span>
                  <span className="text-white capitalize">{formData.timeline?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Stage</span>
                  <span className="text-white capitalize">{formData.interest_level?.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Support Range</span>
                  <span className="text-white">${formData.min_support} - ${formData.max_support}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-white/60 text-sm mb-2">Problem Solved:</p>
              <p className="text-white bg-white/5 rounded-xl p-4">{formData.problem_solved || 'Not provided'}</p>
            </div>

            <div className="bg-primary/30 rounded-xl p-4 border border-primary/50">
              <p className="text-white text-sm">
                <strong className="text-secondary">Moderation Notice:</strong> Your product will be reviewed 
                within 24-72 hours before becoming publicly visible. You'll be notified once approved.
              </p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-primary to-[#0a1628] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a1628]/95 backdrop-blur-lg border-b border-white/10 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
              <Sparkles className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-white">Create Product</h1>
              <p className="text-xs text-white/60">Share your idea with the community</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    currentStep >= step.id 
                      ? 'bg-secondary text-primary' 
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {currentStep > step.id ? <Check size={16} /> : <step.icon size={16} />}
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-8 h-1 mx-1 rounded ${currentStep > step.id ? 'bg-secondary' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Step Title */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-2xl font-bold text-white mb-1">
            {steps[currentStep - 1]?.title}
          </h2>
          <p className="text-white/60">Step {currentStep} of {steps.length}</p>
        </motion.div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex-shrink-0 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all flex items-center gap-2"
            >
              <ChevronLeft size={20} />
              Back
            </button>
          )}
          
          {currentStep < steps.length ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              className="flex-1 py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-secondary to-yellow-500 text-primary font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="submit-product"
            >
              {loading ? 'Submitting...' : 'Submit for Review'}
              <Check size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateProductPage;
