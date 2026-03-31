import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Award, FileText, Calendar, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const availableCertificates = [
  {
    id: 1,
    name: "Academic Transcript",
    description: "Official academic record with grades and courses",
    type: "Academic",
    fee: 25,
    processingTime: "2-3 business days",
    available: true
  },
  {
    id: 2,
    name: "Enrollment Certificate",
    description: "Proof of current enrollment status",
    type: "Administrative",
    fee: 15,
    processingTime: "1 business day",
    available: true
  },
  {
    id: 3,
    name: "Character Certificate",
    description: "Certificate of good conduct and character",
    type: "Administrative",
    fee: 20,
    processingTime: "3-5 business days",
    available: true
  },
  {
    id: 4,
    name: "Degree Certificate",
    description: "Official degree completion certificate",
    type: "Academic",
    fee: 50,
    processingTime: "5-7 business days",
    available: false,
    reason: "Available after graduation"
  },
  {
    id: 5,
    name: "Course Completion Certificate",
    description: "Certificate for specific course completion",
    type: "Course",
    fee: 10,
    processingTime: "1-2 business days",
    available: true
  },
  {
    id: 6,
    name: "Scholarship Certificate",
    description: "Certificate recognizing scholarship achievements",
    type: "Achievement",
    fee: 0,
    processingTime: "2-3 business days",
    available: true
  }
];

const requestHistory = [
  {
    id: 1,
    certificateName: "Enrollment Certificate",
    requestDate: "2024-01-10",
    status: "Completed",
    downloadUrl: "#",
    fee: 15
  },
  {
    id: 2,
    certificateName: "Academic Transcript",
    requestDate: "2024-01-08",
    status: "Processing",
    fee: 25
  },
  {
    id: 3,
    certificateName: "Character Certificate",
    requestDate: "2024-01-05",
    status: "Completed",
    downloadUrl: "#",
    fee: 20
  }
];

export default function Certificates() {
  const { user } = useAuth();

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "Academic":
        return <Badge variant="default">{type}</Badge>;
      case "Administrative":
        return <Badge variant="secondary">{type}</Badge>;
      case "Course":
        return <Badge variant="outline">{type}</Badge>;
      case "Achievement":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return <Badge variant="default">{status}</Badge>;
      case "Processing":
        return <Badge variant="secondary">{status}</Badge>;
      case "Rejected":
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDownloadSample = (certificateName: string) => {
    // Create a simple PDF-like content for demo
    const content = `
CAMPUS UNIVERSITY
${certificateName}

This is to certify that

${user?.name || 'Student Name'}
Student ID: ${user?.id || 'STU001'}
Email: ${user?.email || 'student@campus.edu'}

has been issued this ${certificateName.toLowerCase()} on ${new Date().toLocaleDateString()}.

This is a sample certificate for demonstration purposes.

_____________________
Registrar Office
Campus University
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${certificateName.replace(/\s+/g, '_')}_Sample.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRequestCertificate = (certificateId: number) => {
    const certificate = availableCertificates.find(c => c.id === certificateId);
    if (certificate) {
      alert(`Request submitted for ${certificate.name}. Processing time: ${certificate.processingTime}. Fee: $${certificate.fee}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Certificates</h1>
        <p className="text-muted-foreground">Request and download academic certificates</p>
      </div>

      {/* Student Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Student Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Student ID</p>
              <p className="font-medium">{user?.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Certificates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Available Certificates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableCertificates.map((certificate) => (
              <div key={certificate.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{certificate.name}</h3>
                    <p className="text-sm text-muted-foreground">{certificate.description}</p>
                  </div>
                  {getTypeBadge(certificate.type)}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {certificate.processingTime}
                  </div>
                  <div className="font-medium">
                    Fee: ${certificate.fee}
                  </div>
                </div>

                {!certificate.available && (
                  <p className="text-sm text-destructive">{certificate.reason}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!certificate.available}
                    onClick={() => handleRequestCertificate(certificate.id)}
                  >
                    Request Certificate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadSample(certificate.name)}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    Sample
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Request History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Request History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requestHistory.map((request) => (
              <div key={request.id} className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">{request.certificateName}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span>Requested: {new Date(request.requestDate).toLocaleDateString()}</span>
                    <span>Fee: ${request.fee}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(request.status)}
                  {request.downloadUrl && request.status === "Completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadSample(request.certificateName)}
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Important Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• All certificate requests require verification and may take the stated processing time.</p>
            <p>• Fees are non-refundable once the certificate is processed.</p>
            <p>• Digital certificates are available for immediate download upon completion.</p>
            <p>• Physical copies can be collected from the Registrar's Office during business hours.</p>
            <p>• For urgent requests, contact the Registrar's Office directly.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}