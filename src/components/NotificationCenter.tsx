import { useState, useEffect } from "react";
import { Bell, Clock, CheckCircle2, Trash2, Calendar, FileText, ListChecks, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDepartment } from "@/contexts/DepartmentContext";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";

interface Notification {
  id: string;
  content: string;
  type: "free_text" | "checklist_item";
  completed: boolean | null;
  scheduled_popup_time: string | null;
  is_active: boolean | null;
  created_at: string;
  read: boolean | null;
}

export const NotificationCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const { currentDepartment } = useDepartment();

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from("notes_reminders")
      .select("*")
      .eq("department", currentDepartment)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar notificações:", error);
      return;
    }

    setNotifications((data as unknown as Notification[]) || []);
    
    // Contar itens não lidos
    const unread = (data || []).filter(n => !n.read).length;
    setUnreadCount(unread);
  };

  useEffect(() => {
    fetchNotifications();

    // Verificar pop-ups agendados a cada minuto
    const intervalId = setInterval(checkScheduledPopups, 60000);
    checkScheduledPopups();

    // Realtime subscription
    const channel = supabase
      .channel("notes_reminders_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes_reminders",
          filter: `department=eq.${currentDepartment}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [currentDepartment]);

  const checkScheduledPopups = async () => {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from("notes_reminders")
      .select("*")
      .eq("department", currentDepartment)
      .eq("is_active", true)
      .not("scheduled_popup_time", "is", null)
      .lte("scheduled_popup_time", now);

    if (error || !data || data.length === 0) return;

    data.forEach((notification) => {
      toast({
        title: "⏰ LEMBRETE PROGRAMADO",
        description: notification.content,
        duration: 10000,
      });

      // Desativar o pop-up após exibição
      supabase
        .from("notes_reminders")
        .update({ scheduled_popup_time: null })
        .eq("id", notification.id)
        .then();
    });
  };

  const toggleComplete = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("notes_reminders")
      .update({ completed: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL ATUALIZAR O ITEM",
        variant: "destructive",
      });
      return;
    }

    fetchNotifications();
    toast({
      title: currentStatus ? "ITEM REABERTO" : "ITEM CONCLUÍDO",
      description: "STATUS ATUALIZADO COM SUCESSO",
    });
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from("notes_reminders")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL REMOVER O ITEM",
        variant: "destructive",
      });
      return;
    }

    fetchNotifications();
    toast({
      title: "REMOVIDO",
      description: "ITEM REMOVIDO COM SUCESSO",
    });
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from("notes_reminders")
      .update({ read: true })
      .eq("id", id);

    if (error) {
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL MARCAR COMO LIDA",
        variant: "destructive",
      });
      return;
    }

    fetchNotifications();
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from("notes_reminders")
      .update({ read: true })
      .eq("department", currentDepartment)
      .eq("is_active", true)
      .eq("read", false);

    if (error) {
      toast({
        title: "ERRO",
        description: "NÃO FOI POSSÍVEL MARCAR TODAS COMO LIDAS",
        variant: "destructive",
      });
      return;
    }

    fetchNotifications();
    toast({
      title: "SUCESSO",
      description: "TODAS AS NOTIFICAÇÕES FORAM MARCADAS COMO LIDAS",
    });
  };

  const checklistItems = notifications.filter(n => n.type === "checklist_item");
  const freeTextItems = notifications.filter(n => n.type === "free_text" && !n.scheduled_popup_time);
  const scheduledItems = notifications.filter(n => n.scheduled_popup_time);

  // Contar apenas não lidas
  const unreadNotifications = notifications.filter(n => n.read === false || n.read === null).length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 sm:h-10 sm:w-10 hover:bg-white/20 transition-all duration-300 group rounded-full"
          title="Central de Notificações"
        >
          <div className="absolute inset-0 rounded-full bg-white/10 group-hover:bg-white/20 transition-all duration-300" />
          <Bell className="relative h-4 w-4 sm:h-5 sm:w-5 text-white group-hover:scale-110 group-hover:rotate-12 transition-all duration-300" />
          {unreadNotifications > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-[9px] sm:text-[10px] font-bold shadow-lg animate-pulse"
            >
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl border-l-0 bg-gradient-to-br from-background via-background to-accent/5 p-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <SheetHeader className="relative px-6 pt-6 pb-4 border-b border-border/50 bg-card/50 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Bell className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold tracking-tight">
                  Central de Notificações
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentDepartment}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <Badge variant="secondary" className="h-7 px-3 font-semibold shadow-sm">
                  {notifications.length} {notifications.length === 1 ? 'item' : 'itens'}
                </Badge>
              )}
              {unreadNotifications > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-7 text-xs hover:bg-primary/10 hover:text-primary transition-all"
                >
                  Marcar todas como lidas
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="relative h-[calc(100vh-140px)] px-6 py-4">
          <div className="space-y-5">
            {/* Checklist Items */}
            {checklistItems.length > 0 && (
              <div className="animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 flex items-center justify-center">
                    <ListChecks className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold tracking-tight">Check-list</h3>
                    <p className="text-xs text-muted-foreground">
                      {checklistItems.filter(i => !i.completed).length} pendente(s)
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {checklistItems.map((item, index) => (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "group border border-border/50 hover:border-border transition-all duration-300 hover:shadow-md relative",
                        item.completed && "opacity-60 hover:opacity-80",
                        !item.read && "border-l-4 border-l-blue-500"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardContent className="p-3 flex items-start gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleComplete(item.id, item.completed)}
                          className="h-7 w-7 p-0 rounded-full hover:scale-110 transition-transform"
                        >
                          <CheckCircle2
                            className={cn(
                              "h-5 w-5 transition-all duration-300",
                              item.completed 
                                ? "text-green-500 fill-green-500" 
                                : "text-muted-foreground hover:text-green-500"
                            )}
                          />
                        </Button>
                        <div className="flex-1 space-y-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium leading-tight break-words",
                            item.completed && "line-through text-muted-foreground"
                          )}>
                            {item.content}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(item.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {!item.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(item.id)}
                              className="h-7 w-7 p-0 hover:bg-blue-500/10 hover:text-blue-600 rounded-full transition-all"
                              title="Marcar como lida"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(item.id)}
                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled Popups */}
            {scheduledItems.length > 0 && (
              <div className="animate-fade-in">
                <Separator className="my-5" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold tracking-tight">Lembretes Programados</h3>
                    <p className="text-xs text-muted-foreground">
                      {scheduledItems.length} agendado(s)
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {scheduledItems.map((item, index) => (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "group border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 hover:border-amber-500/50 transition-all duration-300 hover:shadow-md relative",
                        !item.read && "border-l-4 border-l-amber-600"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm font-medium leading-tight break-words">{item.content}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {!item.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(item.id)}
                                className="h-7 w-7 p-0 hover:bg-blue-500/10 hover:text-blue-600 rounded-full transition-all"
                                title="Marcar como lida"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotification(item.id)}
                              className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 rounded-md px-2 py-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.scheduled_popup_time!).toLocaleString("pt-BR")}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Free Text Notes */}
            {freeTextItems.length > 0 && (
              <div className="animate-fade-in">
                <Separator className="my-5" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500/10 to-amber-500/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold tracking-tight">Anotações Salvas</h3>
                    <p className="text-xs text-muted-foreground">
                      {freeTextItems.length} anotação(ões)
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {freeTextItems.map((item, index) => (
                    <Card 
                      key={item.id}
                      className={cn(
                        "group border border-border/50 hover:border-border transition-all duration-300 hover:shadow-md bg-gradient-to-br from-card to-accent/5 relative",
                        !item.read && "border-l-4 border-l-orange-500"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight whitespace-pre-wrap break-words">
                              {item.content}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {!item.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(item.id)}
                                className="h-7 w-7 p-0 hover:bg-blue-500/10 hover:text-blue-600 rounded-full transition-all"
                                title="Marcar como lida"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNotification(item.id)}
                              className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(item.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {notifications.length === 0 && (
              <Card className="border-dashed border-2 bg-gradient-to-br from-card to-accent/5">
                <CardContent className="p-12 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Bell className="h-8 w-8 text-muted-foreground opacity-50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Nenhuma Notificação
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Suas anotações e lembretes aparecerão aqui
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
