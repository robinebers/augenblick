import type { AppSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
  onExpiryMinutes: (minutes: number) => void;
  onTrashDays: (days: number) => void;
  isCheckingUpdates: boolean;
  onCheckUpdates: () => void;
};

export function SettingsDialog({
  settings,
  onClose,
  onTheme,
  onExpiryMinutes,
  onTrashDays,
  isCheckingUpdates,
  onCheckUpdates,
}: Props) {
  const expiryOptions = [
    { minutes: 360, label: "6 hours" },
    { minutes: 720, label: "12 hours" },
    { minutes: 1440, label: "1 day" },
    { minutes: 4320, label: "3 days" },
    { minutes: 10_080, label: "7 days" },
    { minutes: 20_160, label: "14 days" },
    { minutes: 43_200, label: "30 days" },
  ];
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
            <Select
              value={String(settings.expiryMinutes)}
              onValueChange={(v) => onExpiryMinutes(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {expiryOptions.map((option) => (
                  <SelectItem key={option.minutes} value={String(option.minutes)}>
                    {option.label}
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

          <div>
            <div className="mb-2 text-sm font-medium">Updates</div>
            <Button className="w-full" onClick={onCheckUpdates} disabled={isCheckingUpdates}>
              {isCheckingUpdates ? "Checking…" : "Check for updates"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
