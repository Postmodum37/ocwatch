import React from 'react';

export const StatusDot = React.memo<{ status?: string; color: string }>(({ status, color }) => {
  if (status === 'working') {
    return (
      <div className="relative w-2 h-2 flex-shrink-0">
        <div 
          className="absolute inset-0 rounded-full opacity-75 animate-ping"
          style={{ backgroundColor: color }}
        />
        <div 
          className="relative w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    );
  }
  
  if (status === 'idle') {
    return (
      <div 
        className="w-2 h-2 rounded-full animate-pulse flex-shrink-0 bg-success"
      />
    );
  }
  
  if (status === 'completed') {
    return <div className="w-2 h-2 rounded-full bg-border flex-shrink-0" />;
  }

  return <div className="w-2 h-2 rounded-full bg-background flex-shrink-0" />;
});
