type Props={
  title:string;
  icon:string;
  status:string;
};

export default function StatusCard({title,icon,status}:Props){
  return(
    <div className="status-card">
      <h2><span>{icon}</span>{title}</h2>
      <p>{status}</p>
    </div>
  );
}
