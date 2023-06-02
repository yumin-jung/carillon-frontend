import type {
  InferGetStaticPropsType,
  GetStaticProps,
  GetStaticPaths,
} from 'next'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { localPort } from '@/utils/constants'
import SideBar from '../../../../../components/SideBar'
import MessageBlock, { MsgProps } from '../../../../../components/MessageBlock'
import InputBox from '../../../../../components/InputBox'

export const getStaticPaths: GetStaticPaths<{ slug: string }> = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}
export const getStaticProps: GetStaticProps = async () => {
  try {
    const cRes = await fetch(`${localPort}/channels/`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
    const channels = await cRes.json()
    return { props: { channels } }
  } catch (err) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }
}

export default function ChannelComp({
  channels,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const router = useRouter()
  const [channel, setChannel] = useState('')
  const [chatList, setChat] = useState<MsgProps[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const channelID = router.query.channelCode
  const messagesEndRef = useRef<null | HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => {
    scrollToBottom()
  }, [chatList])

  const onPostMessage = (res: { sender: string; content: string }) => {
    setChat((prevChat: MsgProps[]) => {
      return [
        ...prevChat,
        {
          id: '1',
          content: res.content,
          responses: [],
          reactions: {
            Check: [],
            Favorite: [],
            Moodbad: [],
            Thumbup: [],
          },
          sender: { id: '1', name: res.sender },
        },
      ]
    })
  }

  const onDeleteMessage = (res: { messageId: string; content: string }) => {
    setChat((prevChat: MsgProps[]) => [
      ...prevChat.filter((c) => c.id !== res.messageId),
      {
        ...prevChat.filter((c) => c.id === res.messageId)[0],
        content: res.content,
      },
    ])
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onEditMessage = (res: { messageId: string; content: string }) => {
    // FIXME: uncomment after server socket is fixed
    // setChat((prevChat: MsgProps[]) => {
    //   return [
    //     ...prevChat.filter((c) => c.id !== res.messageId),
    //     {
    //       ...prevChat.filter((c) => c.id === res.messageId)[0],
    //       content: res.content,
    //     },
    //   ]
    // })
  }

  const onAddReaction = (res: {
    reactor: string
    reactionType: string
    chatId: string
  }) => {
    setChat((prevChat: MsgProps[]) => [
      ...prevChat.filter((c) => c.id !== res.chatId),
      {
        ...prevChat.filter((c) => c.id === res.chatId)[0],
        reactions: {
          ...prevChat.filter((c) => c.id === res.chatId)[0].reactions,
          [res.reactionType]: [
            ...prevChat.filter((c) => c.id === res.chatId)[0].reactions[
              res.reactionType
            ],
            { userID: res.reactor, userName: 'Quaka' }, // TODO: change sender name
          ],
        },
      },
    ])
  }

  // const onDeleteReaction = () => {} // TODO: after socket is fixed

  const onAddResponse = () => {}

  // const onDeleteResponse = () => {} // TODO: after socket is fixed

  useEffect(() => {
    const skt = io(localPort)
    setSocket(skt)
    scrollToBottom()
    return () => {
      skt.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!socket) {
      return
    }
    const id = localStorage.getItem('_id')
    if (!id) {
      router.push('/')
    }
    socket.emit('connection')
    socket.emit('init', { userId: id })
    socket.on('postMessage', onPostMessage)
    socket.on('deleteMessage', onDeleteMessage)
    socket.on('editMessage', onEditMessage)
    socket.on('addReaction', onAddReaction)
    // socket.on('deleteReaction', onDeleteReaction)
    socket.on('addResponse', onAddResponse)
    // socket.on('delteResponse', onDeleteResponse)
  }, [socket, router])

  useEffect(() => {
    const getData = async () => {
      try {
        const res = await fetch(`${localPort}/chats/${channelID}`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        })
        const data = await res.json()
        setChat(
          data.map(
            (d: {
              _id: string
              content: string
              channel: string
              responses_info: {
                _id: string
                content: string
                channel: string
                reactions_info: {
                  reactionType: string
                  user_info: { _id: string; userName: string }[]
                }[]
                sender: string
              }[]
              reactions_info: {
                reactionType: string
                user_info: { _id: string; userName: string }[]
              }[]
              sender: string
              // sender: { _id: string; userName: string }
            }) => {
              return {
                id: d._id /* eslint no-underscore-dangle: 0 */,
                content: d.content,
                responses: d.responses_info.map(
                  (r: {
                    _id: string
                    content: string
                    channel: string
                    reactions_info: {
                      reactionType: string
                      user_info: { _id: string; userName: string }[]
                    }[]
                    sender: string
                  }) => ({
                    id: r._id,
                    content: r.content,
                    responses: [],
                    reactions: {
                      Check:
                        r.reactions_info
                          .find(
                            (e: {
                              reactionType: string
                              user_info: { _id: string; userName: string }[]
                            }) => e.reactionType === 'Check',
                          )
                          ?.user_info.map(
                            (u: { _id: string; userName: string }) => ({
                              userID: u._id,
                              userName: u.userName,
                            }),
                          ) || [],
                      Favorite:
                        r.reactions_info
                          .find(
                            (e: {
                              reactionType: string
                              user_info: { _id: string; userName: string }[]
                            }) => e.reactionType === 'Favorite',
                          )
                          ?.user_info.map(
                            (u: { _id: string; userName: string }) => ({
                              userID: u._id,
                              userName: u.userName,
                            }),
                          ) || [],
                      Moodbad:
                        r.reactions_info
                          .find(
                            (e: {
                              reactionType: string
                              user_info: { _id: string; userName: string }[]
                            }) => e.reactionType === 'Moodbad',
                          )
                          ?.user_info.map(
                            (u: { _id: string; userName: string }) => ({
                              userID: u._id,
                              userName: u.userName,
                            }),
                          ) || [],
                      Thumbup:
                        r.reactions_info
                          .find(
                            (e: {
                              reactionType: string
                              user_info: { _id: string; userName: string }[]
                            }) => e.reactionType === 'Thumbup',
                          )
                          ?.user_info.map(
                            (u: { _id: string; userName: string }) => ({
                              userID: u._id,
                              userName: u.userName,
                            }),
                          ) || [],
                    },
                    sender: { id: r.sender, name: 'Sihyun2' }, // TODO: need to change sender name
                  }),
                ),
                reactions: {
                  Check:
                    d.reactions_info
                      .find(
                        (e: {
                          reactionType: string
                          user_info: { _id: string; userName: string }[]
                        }) => e.reactionType === 'Check',
                      )
                      ?.user_info.map(
                        (u: { _id: string; userName: string }) => ({
                          userID: u._id,
                          userName: u.userName,
                        }),
                      ) || [],
                  Favorite:
                    d.reactions_info
                      .find(
                        (e: {
                          reactionType: string
                          user_info: { _id: string; userName: string }[]
                        }) => e.reactionType === 'Favorite',
                      )
                      ?.user_info.map(
                        (u: { _id: string; userName: string }) => ({
                          userID: u._id,
                          userName: u.userName,
                        }),
                      ) || [],
                  Moodbad:
                    d.reactions_info
                      .find(
                        (e: {
                          reactionType: string
                          user_info: { _id: string; userName: string }[]
                        }) => e.reactionType === 'Moodbad',
                      )
                      ?.user_info.map(
                        (u: { _id: string; userName: string }) => ({
                          userID: u._id,
                          userName: u.userName,
                        }),
                      ) || [],
                  Thumbup:
                    d.reactions_info
                      .find(
                        (e: {
                          reactionType: string
                          user_info: { _id: string; userName: string }[]
                        }) => e.reactionType === 'Thumbup',
                      )
                      ?.user_info.map(
                        (u: { _id: string; userName: string }) => ({
                          userID: u._id,
                          userName: u.userName,
                        }),
                      ) || [],
                },
                sender: { id: d.sender, name: 'Sihyun' }, // TODO: change to sender name
              }
            },
          ),
        )
        setChannel(() => {
          const filteredList = channels.filter(
            (ch: { _id: string; name: string }) => ch._id === channelID,
          )
          const filteredChannel = filteredList[0]
          return filteredChannel.name
        })
      } catch (err) {
        router.push('/')
      }
    }
    getData()
  }, [router, channelID, channels])

  if (chatList.length === 0 || socket === null) {
    return <div></div>
  }

  return (
    <SideBar>
      <Stack spacing={2} sx={{ height: '90vh', display: 'flex' }}>
        <Typography variant="h3">{channel}</Typography>
        <Stack
          sx={{
            flexGrow: 1,
            overflowY: 'scroll',
          }}
        >
          {chatList.map((msg: MsgProps) => (
            <MessageBlock key={msg.id} message={msg} respond socket={socket} />
          ))}
          <div ref={messagesEndRef} />
        </Stack>
        <InputBox channelID={String(channelID)} respond="" socket={socket} />
      </Stack>
    </SideBar>
  )
}
