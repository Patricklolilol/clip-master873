import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import ClipMaster from '@/components/ClipMaster';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

const Index = () => {
  const { user, signOut } = useAuth();

  if (!user) {
    return null; // Auth will redirect to login
  }

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-10">
        <Button
          onClick={signOut}
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
      <ClipMaster />
    </div>
  );
};

export default Index;