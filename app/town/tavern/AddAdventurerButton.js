"use client";

import { useState } from "react";

export default function AddAdventurerButton() {
  const [showPopup, setShowPopup] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-sm shrink-0"
        onClick={() => setShowPopup(true)}
      >
        + Add Adventurer
      </button>
      {showPopup && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold">Add Adventurer</h3>
            <p className="py-4 text-base-content/70">
              Adventurer commissioning is coming in a future update. For now, adventurers are created manually.
            </p>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setShowPopup(false)}>
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setShowPopup(false)}>close</button>
          </form>
        </dialog>
      )}
    </>
  );
}
