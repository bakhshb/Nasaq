import { useState } from "react";

interface Props {
  documentTypes: string[];
  onClose: () => void;
  onSave: (types: string[]) => Promise<void>;
}

export default function DocumentTypeManager({ documentTypes, onClose, onSave }: Props) {
  const [types, setTypes] = useState([...documentTypes]);
  const [newType, setNewType] = useState("");
  const [saving, setSaving] = useState(false);

  const addType = () => {
    const trimmed = newType.trim();
    if (!trimmed || types.includes(trimmed)) {
      return;
    }
    setTypes((prev) => [...prev, trimmed]);
    setNewType("");
  };

  const removeType = (type: string) => {
    setTypes((prev) => prev.filter((t) => t !== type));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(types);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal modal-sm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Document types</h2>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </header>

        <ul className="type-list">
          {types.map((type) => (
            <li key={type}>
              <span dir="auto">{type}</span>
              <button type="button" className="ghost" onClick={() => removeType(type)}>Remove</button>
            </li>
          ))}
        </ul>

        <div className="add-type-row">
          <input
            type="text"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="New document type"
            dir="auto"
          />
          <button type="button" onClick={addType}>Add</button>
        </div>

        <footer className="modal-footer">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" onClick={handleSave} disabled={saving}>
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
