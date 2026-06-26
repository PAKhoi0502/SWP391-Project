import "../ui.css";
import Modal from "../Modal/Modal";
import Button from "../Button/Button";

function ConfirmDialog({
  open,
  title = "Xác nhận hành động",
  message = "Bạn có chắc muốn tiếp tục không?",
  confirmText = "Xác nhận",
  cancelText = "Hủy",
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