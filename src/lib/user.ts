'use client';
import { Timestamp, type DocumentData } from 'firebase/firestore';

export type UserRole = 'admin' | 'teacher';

export interface User {
  uid: string;
  email: string | null;
  role: UserRole;
  photoUrl?: string;
  displayName?: string;
  isOnline?: boolean;
  permissions?: string[];
  marksPermissions?: Record<string, string[]>; // { "6": ["বাংলা প্রথম", "গণিত"], "9": ["পদার্থ"] }
  lastLoginAt?: Date;
  lastActiveAt?: Date;
}

export const userFromDoc = (doc: any): User => {
    const data = doc.data();
    
    const parseDateField = (field: any): Date | undefined => {
        if (!field) return undefined;
        if (typeof field.toDate === 'function') return field.toDate();
        if (field instanceof Timestamp) return field.toDate();
        if (field.seconds !== undefined) return new Timestamp(field.seconds, field.nanoseconds || 0).toDate();
        const parsed = new Date(field);
        return isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const lastLoginAt = parseDateField(data.lastLoginAt);
    const lastActiveAt = parseDateField(data.lastActiveAt) || lastLoginAt;

    return {
        uid: doc.id,
        email: data.email,
        role: data.role,
        photoUrl: data.photoUrl,
        displayName: data.displayName,
        isOnline: data.isOnline || false,
        permissions: data.permissions || [],
        marksPermissions: data.marksPermissions || {},
        lastLoginAt: lastLoginAt,
        lastActiveAt: lastActiveAt,
    } as User;
}
