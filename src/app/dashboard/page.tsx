"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertTriangle,
  CircleDollarSign,
  PiggyBank,
  Clock,
  Users,
  ListChecks,
  PlusCircle,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react"; // Added trend icons, ArrowRight
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Use NEXT_PUBLIC_ prefix for client-side environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Interface for the summary data expected from the API
interface ShopkeeperSummary {
  totalLoaned: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdueAmount: number;
  overdueLoanCount: number;
  averageRepaymentTimeDays: number | null;
  totalCustomers: number;
  activeLoanCount: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<ShopkeeperSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch summary data function
  const fetchSummary = useCallback(async () => {
    if (!API_URL) {
      setError(
        "API URL is not configured. Please check environment variables."
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/summary`, {
        headers: getAuthHeaders(), // Include auth token
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Failed to parse error response" }));
        throw new Error(
          errorData.message || `Failed to fetch summary (${response.status})`
        );
      }
      const data: ShopkeeperSummary = await response.json();
      setSummary(data);
    } catch (err: any) {
      console.error("Fetch Summary Error:", err);
      setError(
        err.message || "An unknown error occurred while fetching the summary."
      );
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array, relies only on API_URL

  // Fetch summary on component mount
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]); // fetchSummary is stable

  // Helper to format currency
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "₹ --.--"; // More distinct placeholder
    return `₹${Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`; // Use localeString for Indian format
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's a quick overview of your business.
          </p>
        </div>
        {/* Quick Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {/* Link to add customer page with #add hash */}
          <Link href="/dashboard/customers#add" passHref>
            <Button>
              <Users className="mr-2 h-4 w-4" /> Add Customer
            </Button>
          </Link>
          {/* Link to add loan page with #add hash */}
          <Link href="/dashboard/loans#add" passHref>
            <Button variant="secondary">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Loan
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Alert */}
      {error && !loading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Fetching Summary</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="link"
              onClick={fetchSummary}
              className="p-0 h-auto ml-2"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards Section */}
      <Card className="border border-border shadow-sm rounded-lg">
        <CardHeader className="border-b">
          <CardTitle>Financial Snapshot</CardTitle>
          <CardDescription>Key metrics at a glance.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-3 text-lg">Loading summary...</span>
            </div>
          )}
          {/* Summary Data Grid */}
          {summary && !loading && !error && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Outstanding Balance Card */}
              <Card className="group hover:shadow-lg transition-shadow border border-border rounded-lg overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/30">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Outstanding Balance
                  </CardTitle>
                  <ListChecks className="h-5 w-5 text-orange-500 group-hover:scale-110 transition-transform" />
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-orange-600">
                    {formatCurrency(summary.totalOutstanding)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.activeLoanCount ?? "--"} active loan(s)
                  </p>
                </CardContent>
              </Card>

              {/* Overdue Amount Card */}
              <Card className="group hover:shadow-lg transition-shadow border border-destructive/60 rounded-lg overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-destructive/10">
                  <CardTitle className="text-sm font-medium text-destructive/90">
                    Overdue Amount
                  </CardTitle>
                  <AlertTriangle className="h-5 w-5 text-destructive group-hover:scale-110 transition-transform" />
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-destructive">
                    {formatCurrency(summary.totalOverdueAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.overdueLoanCount ?? "--"} overdue loan(s)
                  </p>
                </CardContent>
              </Card>

              {/* Total Collected Card */}
              <Card className="group hover:shadow-lg transition-shadow border border-border rounded-lg overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/30">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Collected
                  </CardTitle>
                  <PiggyBank className="h-5 w-5 text-green-600 group-hover:scale-110 transition-transform" />
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(summary.totalCollected)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total amount repaid
                  </p>
                </CardContent>
              </Card>

              {/* Total Customers Card */}
              <Card className="group hover:shadow-lg transition-shadow border border-border rounded-lg overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/30">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Customers
                  </CardTitle>
                  <Users className="h-5 w-5 text-muted-foreground group-hover:scale-110 transition-transform" />
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold">
                    {summary.totalCustomers ?? "--"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Registered customers
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          {/* Message if summary is empty and not loading */}
          {!summary && !loading && !error && (
            <div className="text-center py-16 text-muted-foreground">
              No summary data available yet. Start by adding customers and
              loans.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Navigation Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Manage Customers Card Link */}
        <Card className="group hover:bg-accent/5 hover:border-primary/50 transition-colors border rounded-lg">
          <Link href="/dashboard/customers" className="block h-full p-6">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" /> Customers
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <CardDescription className="text-sm">
              View, add, or edit your customer profiles.
            </CardDescription>
          </Link>
        </Card>
        {/* Manage Loans Card Link */}
        <Card className="group hover:bg-accent/5 hover:border-primary/50 transition-colors border rounded-lg">
          <Link href="/dashboard/loans" className="block h-full p-6">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ListChecks className="h-5 w-5 text-primary" /> Loans
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <CardDescription className="text-sm">
              Track all active and past credit sales and repayments.
            </CardDescription>
          </Link>
        </Card>
        {/* View Summary Card Link */}
        <Card className="group hover:bg-accent/5 hover:border-primary/50 transition-colors border rounded-lg">
          <Link href="/dashboard/summary" className="block h-full p-6">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" /> Full Summary
              </CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <CardDescription className="text-sm">
              See detailed statistics and performance metrics.
            </CardDescription>
          </Link>
        </Card>
      </div>

      {/* Overdue Loan Snippet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overdue Loan Alerts</CardTitle>
          <CardDescription>Top loans requiring attention.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder for overdue loans list */}
          {loading && (
            <div className="flex justify-center items-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-3 text-lg">Loading overdue loans...</span>
            </div>
          )}
          {!loading && summary && summary.overdueLoanCount > 0 && (
            <ul className="divide-y divide-border">
              {/* Example of how to render a loan - replace with actual data */}
              <li className="py-4 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="font-medium">Customer Name</span>
                  <span className="text-sm text-muted-foreground">
                    Loan ID: #12345
                  </span>
                </div>
                <div className="font-medium text-destructive">₹1,500</div>
              </li>
              {/* Add more overdue loan list items here */}
            </ul>
          )}
          {!loading && summary && summary.overdueLoanCount === 0 && (
            <p className="text-muted-foreground text-sm">
              No overdue loans needing immediate attention.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
