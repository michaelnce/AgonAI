import React from 'react';

interface DebateMessageProps {
  speaker: string;
  content: string;
  turn: number;
}

export const DebateMessage: React.FC<DebateMessageProps> = ({ speaker, content }) => {
  const isProponent = speaker.toLowerCase().includes('proponent');
  const isOpponent = speaker.toLowerCase().includes('opponent');
  const isModerator = speaker.toLowerCase().includes('moderator');

  if (isModerator) {
     // Moderator instructions often appear differently, maybe like a system message or a central block
     return (
       <div className="flex justify-center my-6">
         <div className="bg-[#1E293B] text-gray-300 px-6 py-3 rounded-full text-sm border border-gray-700">
           {content}
         </div>
       </div>
     );
  }

  return (
    <div className={`flex flex-col mb-8 ${isProponent ? 'items-start' : 'items-end'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 mb-2 ${isProponent ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
          isProponent ? 'bg-blue-500' : 'bg-purple-500'
        }`}>
           <span className="text-white text-[10px]">⚡</span>
        </div>
        <span className="font-bold text-white text-xs uppercase tracking-wide">{speaker}</span>
        <span className="text-gray-500 text-[10px]">10:45 AM</span>
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] p-5 rounded-2xl border text-sm leading-relaxed break-words ${
        isProponent 
          ? 'bg-[#1E293B]/80 border-gray-700 text-gray-200 rounded-tl-sm' 
          : 'bg-[#1E293B] border-gray-700 text-gray-200 rounded-tr-sm'
      }`}>
        {content}
      </div>
    </div>
  );
};
