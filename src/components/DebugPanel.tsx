import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';

export const DebugPanel: React.FC = () => {
  const { user, session } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user);

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg max-w-sm z-50">
      <h3 className="font-bold text-sm mb-2">🔍 Debug Info</h3>
      <div className="text-xs space-y-1">
        <div>
          <strong>User ID:</strong> {user?.id || 'None'}
        </div>
        <div>
          <strong>Email:</strong> {user?.email || 'None'}
        </div>
        <div>
          <strong>Role Loading:</strong> {roleLoading ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Role:</strong> {role || 'None'}
        </div>
        <div>
          <strong>Is Admin:</strong> {role === 'admin' ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Has Session:</strong> {session ? 'Yes' : 'No'}
        </div>
        <div>
          <strong>Access Token:</strong> {session?.access_token ? 'Present' : 'Missing'}
        </div>
      </div>
    </div>
  );
};