import React from "react";
import { X } from "lucide-react";
import { useReader } from "../../context/ReaderContext";
import ReaderChrome from "./ReaderChrome";

export default function GlobalReaderDrawer() {
  const { isDrawerOpen, closeDrawer, tabs } = useReader();

  if (!isDrawerOpen && tabs.length === 0) return null;

  return (
    <>
      {isDrawerOpen && (
        <button
          type="button"
          aria-label="Close reader"
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={closeDrawer}
        />
      )}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[min(92vw,720px)] bg-[#F4F7FB] border-l border-[#E5E8EB] shadow-2xl flex flex-col transition-transform duration-200 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E8EB] bg-white">
          <span className="text-xs font-bold text-[#1D1D1F]">Article Reader</span>
          <button
            type="button"
            onClick={closeDrawer}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F7]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 p-3 min-h-0">
          <ReaderChrome />
        </div>
      </aside>
    </>
  );
}
