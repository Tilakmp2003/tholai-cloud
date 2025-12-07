"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  Building2,
  FileText,
  Layers,
  Settings,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Globe,
  ShoppingCart,
  Layout,
  Server,
  Users,
  Calendar,
  DollarSign,
  Shield,
  Gauge,
  Brain,
  Sparkles,
  Target,
  AlertCircle,
  Check,
  X,
  Clock,
  Briefcase,
  Building,
  Mail,
  Phone,
  MapPin,
  Zap,
  Lock,
  Cloud,
  Database,
  Code,
  Smartphone,
  Palette,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import axios from "axios";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// --- Schemas for each step ---
const clientSchema = z.object({
  clientName: z.string().min(2, "Client name is required"),
  clientEmail: z.string().email("Valid email required"),
  clientPhone: z.string().optional(),
  clientCompany: z.string().optional(),
  industry: z.string().min(1, "Select an industry"),
});

const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  projectType: z.string().min(1, "Select a project type"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  deadline: z.string().optional(),
  budget: z.string().optional(),
});

const technicalSchema = z.object({
  platform: z.array(z.string()).min(1, "Select at least one platform"),
  features: z.array(z.string()).min(1, "Select at least one feature"),
  integrations: z.array(z.string()).optional(),
  securityLevel: z.enum(["BASIC", "STANDARD", "ENTERPRISE", "HIPAA_COMPLIANT"]),
  scalability: z.enum(["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"]),
});

// --- Constants ---
const INDUSTRIES = [
  { id: "technology", label: "Technology", icon: Code },
  { id: "finance", label: "Finance & Banking", icon: DollarSign },
  { id: "healthcare", label: "Healthcare", icon: Shield },
  { id: "ecommerce", label: "E-Commerce & Retail", icon: ShoppingCart },
  { id: "education", label: "Education", icon: Users },
  { id: "media", label: "Media & Entertainment", icon: Palette },
  { id: "logistics", label: "Logistics & Supply Chain", icon: Building },
  { id: "other", label: "Other", icon: Briefcase },
];

const PROJECT_TYPES = [
  { id: "web_app", label: "Web Application", icon: Globe, description: "Full-stack web application" },
  { id: "mobile_app", label: "Mobile Application", icon: Smartphone, description: "iOS/Android mobile app" },
  { id: "saas", label: "SaaS Platform", icon: Cloud, description: "Multi-tenant SaaS product" },
  { id: "ecommerce", label: "E-Commerce Store", icon: ShoppingCart, description: "Online store with payments" },
  { id: "dashboard", label: "Admin Dashboard", icon: Layout, description: "Analytics & management panel" },
  { id: "api", label: "API Service", icon: Server, description: "Backend API with docs" },
];

const PLATFORMS = [
  { id: "web", label: "Web (Desktop)", icon: Globe },
  { id: "mobile_responsive", label: "Mobile Responsive", icon: Smartphone },
  { id: "ios", label: "iOS App", icon: Smartphone },
  { id: "android", label: "Android App", icon: Smartphone },
  { id: "pwa", label: "Progressive Web App", icon: Zap },
];

const FEATURE_CATEGORIES = [
  {
    category: "Authentication",
    features: [
      { id: "auth_basic", label: "Email/Password Login" },
      { id: "auth_social", label: "Social Login (Google, GitHub)" },
      { id: "auth_2fa", label: "Two-Factor Auth (2FA)" },
      { id: "auth_sso", label: "SSO / Enterprise Auth" },
    ],
  },
  {
    category: "Core Features",
    features: [
      { id: "crud", label: "CRUD Operations" },
      { id: "search", label: "Search & Filtering" },
      { id: "dashboard", label: "Analytics Dashboard" },
      { id: "notifications", label: "Email/Push Notifications" },
    ],
  },
  {
    category: "Commerce",
    features: [
      { id: "payments", label: "Payment Processing" },
      { id: "subscriptions", label: "Subscription Billing" },
      { id: "cart", label: "Shopping Cart" },
      { id: "inventory", label: "Inventory Management" },
    ],
  },
  {
    category: "Advanced",
    features: [
      { id: "realtime", label: "Real-time Updates" },
      { id: "file_upload", label: "File Upload/Storage" },
      { id: "ai", label: "AI/ML Integration" },
      { id: "reporting", label: "Reports & Exports" },
    ],
  },
];

const INTEGRATIONS = [
  { id: "stripe", label: "Stripe Payments" },
  { id: "aws", label: "AWS Services" },
  { id: "google", label: "Google APIs" },
  { id: "sendgrid", label: "SendGrid Email" },
  { id: "twilio", label: "Twilio SMS" },
  { id: "zapier", label: "Zapier" },
  { id: "salesforce", label: "Salesforce CRM" },
  { id: "slack", label: "Slack" },
];

const SECURITY_LEVELS = [
  { id: "BASIC", label: "Basic", description: "Standard web security, HTTPS" },
  { id: "STANDARD", label: "Standard", description: "OAuth, input validation, rate limiting" },
  { id: "ENTERPRISE", label: "Enterprise", description: "SSO, audit logs, encryption at rest" },
  { id: "HIPAA_COMPLIANT", label: "HIPAA/Compliance", description: "Full compliance, data residency" },
];

const SCALABILITY = [
  { id: "SMALL", label: "Small", description: "< 1,000 users" },
  { id: "MEDIUM", label: "Medium", description: "1,000 - 10,000 users" },
  { id: "LARGE", label: "Large", description: "10,000 - 100,000 users" },
  { id: "ENTERPRISE", label: "Enterprise", description: "100,000+ users" },
];

// --- Steps Definition ---
const STEPS = [
  { id: "client", label: "Client Information", icon: Building2 },
  { id: "project", label: "Project Details", icon: FileText },
  { id: "technical", label: "Technical Specs", icon: Settings },
  { id: "review", label: "Review & Launch", icon: Rocket },
];

interface EnterpriseProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnterpriseProjectWizard({
  open,
  onOpenChange,
}: EnterpriseProjectWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [estimatedComplexity, setEstimatedComplexity] = useState<{
    level: string;
    pages: number;
    timeline: string;
  } | null>(null);

  // Form state aggregator
  const [formData, setFormData] = useState({
    // Client
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientCompany: "",
    industry: "",
    // Project
    name: "",
    projectType: "",
    description: "",
    priority: "MEDIUM" as const,
    deadline: "",
    budget: "",
    // Technical
    platform: [] as string[],
    features: [] as string[],
    integrations: [] as string[],
    securityLevel: "STANDARD" as const,
    scalability: "MEDIUM" as const,
  });

  // Step validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!(formData.clientName && formData.clientEmail && formData.industry);
      case 1:
        return !!(formData.name && formData.projectType && formData.description.length >= 20);
      case 2:
        return formData.platform.length > 0 && formData.features.length > 0;
      default:
        return true;
    }
  };

  // Estimate complexity when step 3 is reached
  useEffect(() => {
    if (currentStep === 3) {
      const featureCount = formData.features.length;
      const integrationCount = formData.integrations?.length || 0;
      const securityScore = ["BASIC", "STANDARD", "ENTERPRISE", "HIPAA_COMPLIANT"].indexOf(formData.securityLevel);
      const scaleScore = ["SMALL", "MEDIUM", "LARGE", "ENTERPRISE"].indexOf(formData.scalability);
      
      const totalScore = featureCount * 5 + integrationCount * 8 + securityScore * 10 + scaleScore * 5;
      
      if (totalScore < 20) {
        setEstimatedComplexity({ level: "Simple", pages: 1, timeline: "1-2 weeks" });
      } else if (totalScore < 50) {
        setEstimatedComplexity({ level: "Moderate", pages: 5, timeline: "3-6 weeks" });
      } else if (totalScore < 100) {
        setEstimatedComplexity({ level: "Complex", pages: 15, timeline: "2-3 months" });
      } else {
        setEstimatedComplexity({ level: "Enterprise", pages: 30, timeline: "4-6 months" });
      }
    }
  }, [currentStep, formData]);

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    } else {
      toast.error("Please fill in all required fields");
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Build comprehensive project description
      const fullDescription = `
PROJECT TYPE: ${PROJECT_TYPES.find(t => t.id === formData.projectType)?.label}
INDUSTRY: ${INDUSTRIES.find(i => i.id === formData.industry)?.label}
PRIORITY: ${formData.priority}
${formData.deadline ? `DEADLINE: ${formData.deadline}` : ""}
${formData.budget ? `BUDGET: ${formData.budget}` : ""}

PLATFORMS: ${formData.platform.map(p => PLATFORMS.find(pl => pl.id === p)?.label).join(", ")}
SECURITY: ${SECURITY_LEVELS.find(s => s.id === formData.securityLevel)?.label}
SCALE: ${SCALABILITY.find(s => s.id === formData.scalability)?.label}

FEATURES: ${formData.features.join(", ")}
${formData.integrations?.length ? `INTEGRATIONS: ${formData.integrations.join(", ")}` : ""}

DESCRIPTION:
${formData.description}
      `.trim();

      const response = await axios.post(`${API_URL}/api/projects`, {
        name: formData.name,
        clientName: formData.clientName,
        description: fullDescription,
        domain: formData.industry,
      });

      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        onOpenChange(false);
        resetForm();
        toast.success("Project initialized! Implementation plan being generated...");
      }, 2000);
    } catch (error: any) {
      console.error("Failed to create project:", error);
      toast.error(`Failed: ${error?.response?.data?.message || error.message}`);
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setFormData({
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientCompany: "",
      industry: "",
      name: "",
      projectType: "",
      description: "",
      priority: "MEDIUM",
      deadline: "",
      budget: "",
      platform: [],
      features: [],
      integrations: [],
      securityLevel: "STANDARD",
      scalability: "MEDIUM",
    });
    setEstimatedComplexity(null);
  };

  const toggleArrayItem = (field: "platform" | "features" | "integrations", item: string) => {
    setFormData((prev) => {
      const current = prev[field] || [];
      const updated = current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item];
      return { ...prev, [field]: updated };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-zinc-950 border-zinc-800 p-0 overflow-hidden">
        <DialogTitle className="sr-only">Initialize New Project</DialogTitle>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[600px] flex flex-col items-center justify-center bg-gradient-to-b from-zinc-950 to-emerald-950/20"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mb-6"
              >
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Project Initialized</h2>
              <p className="text-zinc-400">Generating implementation plan...</p>
            </motion.div>
          ) : (
            <div className="flex flex-col h-[700px]">
              {/* Header with Progress */}
              <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Rocket className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">Initialize New Project</h2>
                      <p className="text-xs text-zinc-500">Enterprise Project Configuration Wizard</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400">
                    Step {currentStep + 1} of {STEPS.length}
                  </Badge>
                </div>

                {/* Step Indicators */}
                <div className="flex items-center justify-between">
                  {STEPS.map((step, index) => (
                    <div key={step.id} className="flex items-center flex-1">
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          index === currentStep
                            ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/50"
                            : index < currentStep
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-800 text-zinc-500"
                        )}
                      >
                        {index < currentStep ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <step.icon className="h-3 w-3" />
                        )}
                        <span className="hidden sm:inline">{step.label}</span>
                      </div>
                      {index < STEPS.length - 1 && (
                        <div
                          className={cn(
                            "flex-1 h-0.5 mx-2",
                            index < currentStep ? "bg-emerald-500/50" : "bg-zinc-800"
                          )}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  {/* Step 1: Client Information */}
                  {currentStep === 0 && (
                    <motion.div
                      key="client"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Client Information</h3>
                        <p className="text-sm text-zinc-400">Who is this project for?</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Client Name *</label>
                          <input
                            type="text"
                            value={formData.clientName}
                            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="John Smith"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Email Address *</label>
                          <input
                            type="email"
                            value={formData.clientEmail}
                            onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="john@company.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Phone Number</label>
                          <input
                            type="tel"
                            value={formData.clientPhone}
                            onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Company</label>
                          <input
                            type="text"
                            value={formData.clientCompany}
                            onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Acme Corp"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-medium text-zinc-400">Industry *</label>
                        <div className="grid grid-cols-4 gap-3">
                          {INDUSTRIES.map((ind) => (
                            <button
                              key={ind.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, industry: ind.id })}
                              className={cn(
                                "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                                formData.industry === ind.id
                                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                              )}
                            >
                              <ind.icon className="h-5 w-5" />
                              <span className="text-xs text-center">{ind.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Project Details */}
                  {currentStep === 1 && (
                    <motion.div
                      key="project"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Project Details</h3>
                        <p className="text-sm text-zinc-400">Define what you're building</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                          <label className="text-xs font-medium text-zinc-400">Project Name *</label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. quantum-commerce-platform"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-medium text-zinc-400">Project Type *</label>
                        <div className="grid grid-cols-3 gap-3">
                          {PROJECT_TYPES.map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, projectType: type.id })}
                              className={cn(
                                "flex flex-col items-start gap-2 p-4 rounded-lg border transition-all text-left",
                                formData.projectType === type.id
                                  ? "border-indigo-500 bg-indigo-500/10"
                                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
                              )}
                            >
                              <type.icon className={cn("h-5 w-5", formData.projectType === type.id ? "text-indigo-400" : "text-zinc-500")} />
                              <div>
                                <p className={cn("text-sm font-medium", formData.projectType === type.id ? "text-indigo-400" : "text-zinc-300")}>{type.label}</p>
                                <p className="text-xs text-zinc-500">{type.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400">Project Description *</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={4}
                          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          placeholder="Describe your project requirements, goals, and target audience..."
                        />
                        <p className="text-xs text-zinc-500">{formData.description.length}/20 characters minimum</p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Priority</label>
                          <select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Target Deadline</label>
                          <input
                            type="date"
                            value={formData.deadline}
                            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Budget Range</label>
                          <select
                            value={formData.budget}
                            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select budget</option>
                            <option value="$5k-$10k">$5,000 - $10,000</option>
                            <option value="$10k-$25k">$10,000 - $25,000</option>
                            <option value="$25k-$50k">$25,000 - $50,000</option>
                            <option value="$50k-$100k">$50,000 - $100,000</option>
                            <option value="$100k+">$100,000+</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Technical Specs */}
                  {currentStep === 2 && (
                    <motion.div
                      key="technical"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Technical Specifications</h3>
                        <p className="text-sm text-zinc-400">Define platforms, features, and requirements</p>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-medium text-zinc-400">Target Platforms *</label>
                        <div className="flex flex-wrap gap-2">
                          {PLATFORMS.map((platform) => (
                            <button
                              key={platform.id}
                              type="button"
                              onClick={() => toggleArrayItem("platform", platform.id)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                                formData.platform.includes(platform.id)
                                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                              )}
                            >
                              <platform.icon className="h-4 w-4" />
                              <span className="text-sm">{platform.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-medium text-zinc-400">Features *</label>
                        <div className="grid grid-cols-2 gap-4">
                          {FEATURE_CATEGORIES.map((cat) => (
                            <div key={cat.category} className="space-y-2">
                              <p className="text-xs font-medium text-zinc-500">{cat.category}</p>
                              <div className="flex flex-wrap gap-2">
                                {cat.features.map((feature) => (
                                  <button
                                    key={feature.id}
                                    type="button"
                                    onClick={() => toggleArrayItem("features", feature.id)}
                                    className={cn(
                                      "px-3 py-1.5 rounded text-xs border transition-all",
                                      formData.features.includes(feature.id)
                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                                    )}
                                  >
                                    {feature.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-medium text-zinc-400">Third-Party Integrations</label>
                        <div className="flex flex-wrap gap-2">
                          {INTEGRATIONS.map((int) => (
                            <button
                              key={int.id}
                              type="button"
                              onClick={() => toggleArrayItem("integrations", int.id)}
                              className={cn(
                                "px-3 py-1.5 rounded text-xs border transition-all",
                                formData.integrations?.includes(int.id)
                                  ? "border-purple-500 bg-purple-500/10 text-purple-400"
                                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                              )}
                            >
                              {int.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Security Level</label>
                          <div className="space-y-2">
                            {SECURITY_LEVELS.map((level) => (
                              <button
                                key={level.id}
                                type="button"
                                onClick={() => setFormData({ ...formData, securityLevel: level.id as any })}
                                className={cn(
                                  "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                                  formData.securityLevel === level.id
                                    ? "border-amber-500 bg-amber-500/10"
                                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
                                )}
                              >
                                <Shield className={cn("h-4 w-4 mt-0.5", formData.securityLevel === level.id ? "text-amber-400" : "text-zinc-500")} />
                                <div>
                                  <p className={cn("text-sm font-medium", formData.securityLevel === level.id ? "text-amber-400" : "text-zinc-300")}>{level.label}</p>
                                  <p className="text-xs text-zinc-500">{level.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-zinc-400">Expected Scale</label>
                          <div className="space-y-2">
                            {SCALABILITY.map((scale) => (
                              <button
                                key={scale.id}
                                type="button"
                                onClick={() => setFormData({ ...formData, scalability: scale.id as any })}
                                className={cn(
                                  "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                                  formData.scalability === scale.id
                                    ? "border-cyan-500 bg-cyan-500/10"
                                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-600"
                                )}
                              >
                                <Gauge className={cn("h-4 w-4 mt-0.5", formData.scalability === scale.id ? "text-cyan-400" : "text-zinc-500")} />
                                <div>
                                  <p className={cn("text-sm font-medium", formData.scalability === scale.id ? "text-cyan-400" : "text-zinc-300")}>{scale.label}</p>
                                  <p className="text-xs text-zinc-500">{scale.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Review */}
                  {currentStep === 3 && (
                    <motion.div
                      key="review"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Review & Launch</h3>
                        <p className="text-sm text-zinc-400">Confirm your project configuration</p>
                      </div>

                      {/* Complexity Estimate Card */}
                      {estimatedComplexity && (
                        <div className="p-4 rounded-lg border border-indigo-500/30 bg-indigo-500/5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                              <Brain className="h-6 w-6 text-indigo-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-zinc-400">Estimated Complexity</p>
                              <p className="text-xl font-bold text-indigo-400">{estimatedComplexity.level}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-zinc-400">Implementation Plan</p>
                              <p className="text-lg font-semibold text-white">~{estimatedComplexity.pages} pages</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-zinc-400">Est. Timeline</p>
                              <p className="text-lg font-semibold text-white">{estimatedComplexity.timeline}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Summary Sections */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
                          <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-indigo-400" /> Client
                          </h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-white">{formData.clientName}</p>
                            <p className="text-zinc-400">{formData.clientEmail}</p>
                            <p className="text-zinc-500">{INDUSTRIES.find(i => i.id === formData.industry)?.label}</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
                          <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-emerald-400" /> Project
                          </h4>
                          <div className="space-y-1 text-sm">
                            <p className="text-white font-mono">{formData.name}</p>
                            <p className="text-zinc-400">{PROJECT_TYPES.find(t => t.id === formData.projectType)?.label}</p>
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              formData.priority === "CRITICAL" ? "border-red-500 text-red-400" :
                              formData.priority === "HIGH" ? "border-orange-500 text-orange-400" :
                              formData.priority === "MEDIUM" ? "border-yellow-500 text-yellow-400" : "border-zinc-500 text-zinc-400"
                            )}>{formData.priority}</Badge>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 col-span-2">
                          <h4 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-purple-400" /> Technical Specs
                          </h4>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-zinc-500 text-xs mb-1">Platforms</p>
                              <div className="flex flex-wrap gap-1">
                                {formData.platform.map(p => (
                                  <Badge key={p} variant="outline" className="text-xs border-zinc-600">{PLATFORMS.find(pl => pl.id === p)?.label}</Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-zinc-500 text-xs mb-1">Features ({formData.features.length})</p>
                              <p className="text-zinc-300 text-xs">{formData.features.slice(0, 3).join(", ")}{formData.features.length > 3 ? "..." : ""}</p>
                            </div>
                            <div>
                              <p className="text-zinc-500 text-xs mb-1">Security & Scale</p>
                              <p className="text-zinc-300 text-xs">{formData.securityLevel} / {formData.scalability}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-400">Ready to Launch</p>
                            <p className="text-xs text-zinc-400 mt-1">
                              Upon initialization, our AI agents will generate a comprehensive implementation plan for your review.
                              You'll be able to approve, revise, or request changes before development begins.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={currentStep === 0 ? () => onOpenChange(false) : handleBack}
                  className="text-zinc-400 hover:text-white"
                >
                  {currentStep === 0 ? (
                    <>
                      <X className="h-4 w-4 mr-2" /> Cancel
                    </>
                  ) : (
                    <>
                      <ChevronLeft className="h-4 w-4 mr-2" /> Back
                    </>
                  )}
                </Button>

                {currentStep < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="bg-indigo-600 hover:bg-indigo-500"
                  >
                    Continue <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Initializing...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" /> Launch Project
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
