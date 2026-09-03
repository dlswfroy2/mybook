'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/hooks/useAuth';

export function FirebaseErrorListener() {
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Admins have full access and should never receive access denied notifications
      if (user?.role === 'admin' || user?.email?.toLowerCase() === 'dlswf.roy@gmail.com') {
        return;
      }

      toast({
        variant: 'destructive',
        title: 'অ্যাক্সেস ডিনাইড',
        description: `আপনার এই কাজটি করার অনুমতি নেই। পাথ: ${error.context.path}`,
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast, user]);

  return null;
}
