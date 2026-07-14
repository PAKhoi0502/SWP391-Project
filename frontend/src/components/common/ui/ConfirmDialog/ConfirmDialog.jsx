import "../ui.css";
import Modal from "../Modal/Modal";
import Button from "../Button/Button";

function ConfirmDialog({
  open,
  title = "Confirm action",
  message = "Are you sure you want to continue?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelText}
          </Button>

          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p style={{ color: "#6b7280", lineHeight: "1.6" }}>{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;