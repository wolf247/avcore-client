FROM ubuntu:18.04
USER root

#software
RUN apt-get update \
&& apt-get install -y wget git-core apt-utils software-properties-common \
&& add-apt-repository ppa:jonathonf/ffmpeg-4 -y \
&& cd /root/ && wget https://deb.nodesource.com/setup_10.x && chmod +x ./setup_10.x && ./setup_10.x \
&& apt-get install -y nodejs build-essential ffmpeg libgstreamer1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav gstreamer1.0-doc gstreamer1.0-tools gstreamer1.0-x gstreamer1.0-alsa gstreamer1.0-gl gstreamer1.0-gtk3 gstreamer1.0-qt5 gstreamer1.0-pulseaudio -y

#repo
COPY ./ /root/Lebenshilfe
RUN cd /root/Lebenshilfe && npm install && npm run build

#ssh (remove after release)
RUN apt-get update \
    && apt-get install openssh-server -y
RUN mkdir /root/.ssh/
ARG ssh
RUN echo ${ssh} >> /root/.ssh/authorized_keys
RUN sed -i s,"#Port 22","Port 30022",g /etc/ssh/sshd_config

#server
WORKDIR /root/Lebenshilfe/
#CMD npm start
CMD service ssh start; npm start; exec /bin/bash -c "trap : TERM INT; sleep infinity & wait"