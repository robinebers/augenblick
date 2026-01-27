import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cancelDialog, resolveDialog, useDialogStore } from "@/stores/dialogStore";

function buttonVariant(variant: "default" | "secondary" | "destructive" = "default") {
  if (variant === "destructive") return "destructive";
  if (variant === "secondary") return "outline";
  return "default";
}

export function DialogHost() {
  const request = useDialogStore((s) => s.request);
  if (!request) return null;

  return (
    <AlertDialog
      open
      onOpenChange={(next: boolean) => {
        if (!next) cancelDialog();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request.title}</AlertDialogTitle>
          {request.description ? (
            <AlertDialogDescription>{request.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {request.actions.map((action) => (
            <Button
              key={action.id}
              variant={buttonVariant(action.variant ?? "default")}
              onClick={() => resolveDialog(action.id)}
            >
              {action.label}
            </Button>
          ))}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
