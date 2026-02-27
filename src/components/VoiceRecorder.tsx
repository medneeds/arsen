import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VoiceRecorderProps {
  onTranscriptionComplete: (data: {
    summary: string;
    clinicalStatus: string;
    pendingProcedures: string;
    relevantObservations: string;
  }) => void;
}

export function VoiceRecorder({ onTranscriptionComplete }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      toast({
        title: "Gravando",
        description: "Fale naturalmente sobre a passagem de plantão...",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Failed to convert audio to base64');
        }

        console.log("Sending audio for transcription...");

        // Call edge function for transcription
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { audioBase64: base64Audio },
        });

        if (error) {
          throw error;
        }

        console.log("Transcription result:", data);

        toast({
          title: "Transcrição concluída!",
          description: "Os campos foram preenchidos automaticamente.",
        });

        onTranscriptionComplete(data);
        setIsProcessing(false);
      };

      reader.onerror = () => {
        throw new Error('Failed to read audio file');
      };
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Erro na transcrição",
        description: error.message || "Não foi possível processar o áudio.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording && !isProcessing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startRecording}
          className="gap-2"
        >
          <Mic className="h-4 w-4" />
          Gravar Passagem
        </Button>
      )}
      
      {isRecording && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={stopRecording}
          className="gap-2 animate-pulse"
        >
          <Square className="h-4 w-4 fill-current" />
          Parar Gravação
        </Button>
      )}
      
      {isProcessing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          className="gap-2"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Transcrevendo...
        </Button>
      )}
    </div>
  );
}
