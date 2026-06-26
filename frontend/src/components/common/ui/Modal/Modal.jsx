import "../ui.css";

function Modal({
  open,
  title,
  children,
  footer,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div className="ui-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ui-modal-header">
          <h3 className="ui-modal-title">{title}</h3>
          <button className="ui-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="ui-modal-body">{children}</div>

        {footer && <div className="ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;