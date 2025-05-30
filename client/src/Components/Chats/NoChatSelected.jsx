import { icons } from '@/Assets/icons';

export default function NoChatSelected() {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-[#f6f6f6] text-center">
            <div className="size-20 fill-none stroke-gray-300">
                {icons.noChatSelected}
            </div>
            <h2 className="mt-2 text-xl font-semibold text-gray-800">
                No Chat Selected
            </h2>
            <p className="mt-2 text-gray-500 max-w-[400px] px-4 text-sm">
                Keep the Conversation going, or Start a new one by adding a
                collaboration.
            </p>
        </div>
    );
}
