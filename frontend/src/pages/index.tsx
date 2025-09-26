import Link from "next/link";

export default function Landing() {
  return (
    <div className="w-full bg-starfield bg-cover bg-center relative">
      <div className="min-h-[calc(100vh-64px)] relative">
        <img src="/rocket.svg" className="pointer-events-none h-[50vh] absolute bottom-0 left-0" />
        <div className="min-h-[calc(100vh-64px)] container mx-auto sm pb-[10vh] flex flex-col justify-center text-center">
          <img src="/hydra.svg" className="pointer-events-none h-[20vh] mb-5" />
          <div className="flex flex-row justify-center items-center mb-[6vh]">
            <img src="/logo-mesh-white-300x300.png" className="h-[50px] mr-3" />
            <span className="font-inter-regular text-xl text-[#A0A0A0]">By Mesh</span>
          </div>
          <h2 className="font-dmsans-regular text-2xl text-[#F1E9D9] mb-8 leading-relaxed">
            A <span className="font-dmsans-semibold">Cardano bot challenge</span> to showcase the capabilities<br/> of the <span className="font-dmsans-semibold">eUTxO model
              and Hydra L2 scaling solution
              </span>.
          </h2>
          <div className="text-center">
            <Link href="/how-to-play">
              <button className="font-monocraft-regular text-black bg-[#e9ebee] py-4 px-8 rounded-full text-lg">
                How to play
              </button>
            </Link>
          </div>
          <div className="text-center mt-8">
            <Link href="/start">
              <button className="font-monocraft-regular text-black bg-[#e9ebee] py-4 px-8 rounded-full text-lg">
                Game setup
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

Landing.showNavBar = true;