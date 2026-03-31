import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Download, AlertCircle, CheckCircle, Clock } from "lucide-react";

const feeData = [
  {
    id: 1,
    semester: "Fall 2024",
    tuitionFee: 15000,
    libraryFee: 500,
    labFee: 800,
    sportsFee: 300,
    totalAmount: 16600,
    paidAmount: 16600,
    dueDate: "2024-01-15",
    status: "Paid",
    paymentDate: "2024-01-10"
  },
  {
    id: 2,
    semester: "Spring 2024",
    tuitionFee: 15000,
    libraryFee: 500,
    labFee: 800,
    sportsFee: 300,
    totalAmount: 16600,
    paidAmount: 10000,
    dueDate: "2024-06-15",
    status: "Partial",
    paymentDate: null
  },
  {
    id: 3,
    semester: "Summer 2024",
    tuitionFee: 8000,
    libraryFee: 300,
    labFee: 400,
    sportsFee: 200,
    totalAmount: 8900,
    paidAmount: 0,
    dueDate: "2024-08-15",
    status: "Pending",
    paymentDate: null
  }
];

const scholarships = [
  {
    id: 1,
    name: "Academic Excellence Scholarship",
    amount: 5000,
    semester: "Spring 2024",
    status: "Applied"
  },
  {
    id: 2,
    name: "Merit Scholarship",
    amount: 3000,
    semester: "Fall 2024",
    status: "Approved"
  }
];

export default function FeeTracking() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Paid":
        return <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Paid
        </Badge>;
      case "Partial":
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Partial
        </Badge>;
      case "Pending":
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Pending
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalOutstanding = feeData.reduce((sum, fee) => sum + (fee.totalAmount - fee.paidAmount), 0);
  const totalPaid = feeData.reduce((sum, fee) => sum + fee.paidAmount, 0);
  const totalFees = feeData.reduce((sum, fee) => sum + fee.totalAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Fee Tracking</h1>
        <p className="text-muted-foreground">Monitor your fee payments and scholarship status</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">${totalOutstanding.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Amount due</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalPaid.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Payments made</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Payment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {Math.round((totalPaid / totalFees) * 100)}%
            </div>
            <Progress value={(totalPaid / totalFees) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Next Due Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground">Aug 15, 2024</div>
            <p className="text-xs text-muted-foreground mt-1">Summer 2024 fees</p>
          </CardContent>
        </Card>
      </div>

      {/* Fee Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Details by Semester</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semester</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Paid Amount</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeData.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-medium">{fee.semester}</TableCell>
                  <TableCell>${fee.totalAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-green-600">${fee.paidAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-destructive">
                    ${(fee.totalAmount - fee.paidAmount).toLocaleString()}
                  </TableCell>
                  <TableCell>{new Date(fee.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{getStatusBadge(fee.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {fee.status !== "Paid" && (
                        <Button size="sm" className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          Pay Now
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        Receipt
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Fee Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Current Semester Fee Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-lg font-bold text-foreground">$15,000</div>
              <div className="text-sm text-muted-foreground">Tuition Fee</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-lg font-bold text-foreground">$800</div>
              <div className="text-sm text-muted-foreground">Lab Fee</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-lg font-bold text-foreground">$500</div>
              <div className="text-sm text-muted-foreground">Library Fee</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-lg font-bold text-foreground">$300</div>
              <div className="text-sm text-muted-foreground">Sports Fee</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scholarships */}
      <Card>
        <CardHeader>
          <CardTitle>Scholarships & Financial Aid</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scholarships.map((scholarship) => (
              <div key={scholarship.id} className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">{scholarship.name}</h4>
                  <p className="text-sm text-muted-foreground">{scholarship.semester}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">${scholarship.amount.toLocaleString()}</div>
                  <Badge variant={scholarship.status === "Approved" ? "default" : "secondary"}>
                    {scholarship.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}