type Props = {
  title: string;
  value: string;
};

function StatusCard({ title, value }: Props) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{value}</p>
    </div>
  );
}

export default StatusCard;