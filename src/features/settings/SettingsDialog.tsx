import type { AppSettings } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  settings: AppSettings;
  onClose: () => void;
  onTheme: (theme: AppSettings["theme"]) => void;
  onExpiryDays: (days: number) => void;
  onTrashDays: (days: number) => void;
};

export function SettingsDialog({ settings, onClose, onTheme, onExpiryDays, onTrashDays }: Props) {
  const expiryOptions = [1, 3, 7, 14, 30];
  const trashOptions = [7, 14, 30, 60, 90];

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent onInteractOutside={onClose}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences for appearance, expiry, and trash.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="mb-2 text-sm font-medium">Appearance</div>
            <Tabs
              value={settings.theme}
              onValueChange={(value) => onTheme(value as AppSettings["theme"])}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="light">Light</TabsTrigger>
                <TabsTrigger value="dark">Dark</TabsTrigger>
                <TabsTrigger value="system">System</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Note Expiry</div>
            <Select value={String(settings.expiryDays)} onValueChange={(v) => onExpiryDays(Number(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {expiryOptions.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Trash Retention</div>
            <Select
              value={String(settings.trashRetentionDays)}
              onValueChange={(v) => onTrashDays(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trashOptions.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
