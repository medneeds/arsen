import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SepsisProtocolPage() {
  const navigate = useNavigate();
  const pdfUrl = "/documents/protocolo-sepse-adulto.pdf";

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'PROTOCOLO_SEPSE_ADULTO.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/documents")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold uppercase">PROTOCOLO SEPSE</h1>
        </div>

        <div className="bg-card border rounded-lg p-8 space-y-6">
          <div className="grid gap-4">
            <Button 
              size="lg"
              className="w-full h-16 text-lg"
              onClick={handleDownload}
            >
              <Download className="mr-2 h-5 w-5" />
              DOWNLOAD PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
